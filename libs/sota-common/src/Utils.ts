// Get current timestamp in millisecond
import URL from 'url';
import { EnvConfigRegistry } from '..';
import { getLogger } from './Logger';
const logger = getLogger('Utils_Common');
const nodemailer = require('nodemailer');

export function nowInMillis(): number {
  return Date.now();
}

// Alias for nowInMillis
export function now(): number {
  return nowInMillis();
}

export function nowInSeconds(): number {
  return (nowInMillis() / 1000) | 0;
}

export function isValidURL(urlString: string): boolean {
  try {
    const parsedUrl = new URL.URL(urlString);
  } catch (e) {
    return false;
  }

  return true;
}

export function reflect(promise: any) {
  return promise
    .then((data: any) => {
      return { data, status: 'resolved' };
    })
    .catch((error: any) => {
      return { error, status: 'rejected' };
    });
}

export async function timeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * promise all and handle error message
 * @param values
 * @constructor
 */
export async function PromiseAll(values: any[]): Promise<any[]> {
  let results: any[];
  await (async () => {
    return await Promise.all(values.map(reflect));
  })().then(async res => {
    const errors: any[] = [];
    results = res.map(r => {
      if (r.status === 'rejected') {
        errors.push(r.error);
      }
      return r.data;
    });
    if (errors.length !== 0) {
      // have lots of error, throw first error
      throw errors[0];
    }
  });
  return results;
}

/**
 * Remove " and \" characters
 * @param value
 * @private
 */
function _removeDoubleQuote(value: string) {
  return value.replace(/\\\"/g, '').replace(/\"/g, '');
}

/* Put this in a helper library somewhere */
export function override(container: any, key: any) {
  const baseType = Object.getPrototypeOf(container);
  if (typeof baseType[key] !== 'function') {
    const overrideError: string =
      'Method ' + key + ' of ' + container.constructor.name + ' does not override any base class method';
    throw new Error(overrideError);
  }
}

/* Put this in a helper library somewhere */
export function implement(container: any, key: any) {
  const baseType = Object.getPrototypeOf(container);
  if (typeof baseType[key] === 'function') {
    const overrideError: string = 'Method ' + key + ' of ' + container.constructor.name + ' implemented on base class';
    throw new Error(overrideError);
  }
}

export async function sendMail(mailReceiver: string, subject: string, text: string) {
  if (!mailReceiver || !isValidEmail(mailReceiver)) {
    logger.warn(`Invalid mail receiver: ${mailReceiver}`);
    return;
  }

  // Old simple style - sending email by gmail, use these configs:
  // + MAILER_ACCOUNT
  // + MAILER_PASSWORD
  let mailUserName = EnvConfigRegistry.getCustomEnvConfig('MAILER_ACCOUNT');
  let mailPassword = EnvConfigRegistry.getCustomEnvConfig('MAILER_PASSWORD');
  if (mailUserName && mailPassword) {
    await sendNormalMail(mailUserName, mailPassword, mailReceiver, subject, text);
    return;
  }

  // New style config with more options
  mailUserName = EnvConfigRegistry.getCustomEnvConfig('MAIL_USERNAME');
  mailPassword = EnvConfigRegistry.getCustomEnvConfig('MAIL_PASSWORD');
  const mailHost = EnvConfigRegistry.getCustomEnvConfig('MAIL_HOST');
  const mailPort = EnvConfigRegistry.getCustomEnvConfig('MAIL_PORT');
  const mailFromName = EnvConfigRegistry.getCustomEnvConfig('MAIL_FROM_NAME');
  const mailFromAddress = EnvConfigRegistry.getCustomEnvConfig('MAIL_FROM_ADDRESS');
  const mailDrive = EnvConfigRegistry.getCustomEnvConfig('MAIL_DRIVER');
  const mailEncryption = EnvConfigRegistry.getCustomEnvConfig('MAIL_ENCRYPTION');

  // if (!mailUserName || !mailPassword) {
  //   logger.error(`Revise this: MAILER_ACCOUNT=${mailUserName}, MAILER_PASSWORD=${mailPassword}}`);
  //   return;
  // }

  const transporter = nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure: mailPort === '465' ? true : false,
    auth: {
      user: mailUserName,
      pass: mailPassword,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: mailUserName,
    to: mailReceiver,
    subject,
    envelope: {
      from: `${mailFromName} <${mailFromAddress}>`,
      to: mailReceiver,
    },
    html: text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Message sent: ${info.messageId}`);
    logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  } catch (e) {
    logger.error(e);
  }
}

export async function sendNormalMail(
  mailerAccount: string,
  mailerPassword: string,
  mailerReceiver: string,
  subject: string,
  text: string,
  service?: string
) {
  const transporter = nodemailer.createTransport({
    service: service || 'gmail',
    auth: {
      user: mailerAccount,
      pass: mailerPassword,
    },
  });

  const mailOptions = {
    from: mailerAccount,
    to: mailerReceiver,
    subject,
    html: text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Message sent: ${info.messageId}`);
    logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  } catch (e) {
    logger.error(e);
  }
}

export function isValidEmail(email: string) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}
