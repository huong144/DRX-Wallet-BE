import _ from 'lodash';
import winston from 'winston';
import util from 'util';
import EnvConfigRegistry from './registries/EnvConfigRegistry';
import { Utils } from '..';

let ERROR_STASHES: string[] = [];
let ERROR_SENDING_INTERVAL: number;
if (process.env.ERROR_SENDING_INTERVAL) {
  ERROR_SENDING_INTERVAL = parseInt(process.env.ERROR_SENDING_INTERVAL, 10);
}

// Default interval is 15 minutes
if (!ERROR_SENDING_INTERVAL || isNaN(ERROR_SENDING_INTERVAL)) {
  ERROR_SENDING_INTERVAL = 15 * 60 * 1000;
}

setInterval(notifyErrors, ERROR_SENDING_INTERVAL);

const enumerateErrorFormat = winston.format(info => {
  if (info instanceof Error) {
    return Object.assign(
      {
        message: info.message,
        stack: info.stack,
      },
      info
    );
  }
  return info;
});

export function getLogger(name: string) {
  const has = winston.loggers.has(name);
  if (!has) {
    const transports: any[] = [];
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(info => {
            const { timestamp, level, message, ...extra } = info;

            return `${timestamp} [${level}]: ${message} ${Object.keys(extra).length ? util.inspect(extra) : ''}`;
          })
        ),
        stderrLevels: ['error'],
      })
    );

    winston.loggers.add(name, {
      level: process.env.LOG_LEVEL || 'debug',
      format: winston.format.combine(enumerateErrorFormat()),
      transports,
    });
  }

  // return winston.loggers.get(name);
  return {
    debug(msg: any) {
      return winston.loggers.get(name).debug(msg);
    },
    info(msg: any) {
      return winston.loggers.get(name).info(msg);
    },
    warn(msg: any) {
      return winston.loggers.get(name).warn(msg);
    },
    error(msg: any) {
      ERROR_STASHES.push(`[ERROR] ${msg}`);
      return winston.loggers.get(name).error(msg);
    },
    fatal(msg: any) {
      // Setup error
      ERROR_STASHES.push(`[ERROR] ${msg}`);
      return winston.loggers.get(name).error(msg);
    },
    async notifyErrorsImmediately() {
      try {
        await notifyErrors();
      } catch (err) {
        console.error(`======= UNCAUGHT ERROR NOTIFYING BEGIN =======`);
        console.error(err);
        console.error(`======= UNCAUGHT ERROR NOTIFYING END =======`);
      }
    },
  };
}

async function notifyErrors() {
  if (!ERROR_STASHES.length) {
    return;
  }

  const messages = _.uniq(ERROR_STASHES);
  ERROR_STASHES = [];
  let mailReceiver = EnvConfigRegistry.getCustomEnvConfig('MAIL_RECEIVER');
  // Fallback to old env config
  if (!mailReceiver) {
    mailReceiver = EnvConfigRegistry.getCustomEnvConfig('MAILER_RECEIVER');
  }

  const appName: string = process.env.APP_NAME || 'Exchange Wallet';
  const env: string = process.env.NODE_ENV || 'development';
  const subject = `[${appName}][${env}] Error Notifier`;
  Utils.sendMail(mailReceiver, subject, `${messages.join('<br />')}`);
}
