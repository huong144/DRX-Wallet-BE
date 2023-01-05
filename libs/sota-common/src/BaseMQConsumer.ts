import amqp, { Options } from 'amqplib';
import util from 'util';
import { getLogger } from './Logger';

const logger = getLogger('BaseMQConsumer');

type Constructor<T = {}> = new (...args: any[]) => T;

export function BaseMQConsumer<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    // TODO: Have to change accessible level to declaration generator works
    /*protected*/ public _consumerQueue: string;

    public setConsumerQueueName(queueName: string): void {
      this._consumerQueue = queueName;
    }

    /*protected*/ public async onConsumingMessage(msg: amqp.ConsumeMessage): Promise<boolean> {
      logger.warn(`${this.constructor.name}::onConsumingMessage do nothing msg=${msg.content}`);
      return false;
    }

    /*protected*/ public async setupConsumer(options: Options.Connect): Promise<void> {
      if (!this._consumerQueue) {
        logger.warn(`${this.constructor.name} has empty queue name. Just skip setup connection...`);
        return;
      }

      try {
        const connection = await amqp.connect(options);
        const channel = await connection.createChannel();
        await channel.assertQueue(this._consumerQueue, { durable: true });
        await channel.consume(this._consumerQueue, async msg => {
          try {
            const isConsumed = await this.onConsumingMessage(msg);
            if (isConsumed) {
              channel.ack(msg);
            } else {
              channel.nack(msg);
            }
          } catch (e) {
            logger.error(`${this.constructor.name} error when consuming msg=${util.inspect(msg)}`);
            logger.error(e);
            // Skip the msg that causes exception
            channel.ack(msg);
          }
        });
      } catch (e) {
        throw new Error(e.message);
      }
    }
  };
}

export default BaseMQConsumer;
