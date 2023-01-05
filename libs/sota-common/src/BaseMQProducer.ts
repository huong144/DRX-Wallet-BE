import amqp, { Options } from 'amqplib';
import { getLogger } from './Logger';

const logger = getLogger('BaseMQProducer');

type Constructor<T = {}> = new (...args: any[]) => T;

export function BaseMQProducer<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    // TODO: Change accessible level to make declaration works
    /*protected*/ public _producerQueue: string;
    /*protected*/ public _producerChannel: amqp.Channel;

    public setProducerQueueName(queueName: string): void {
      this._producerQueue = queueName;
    }

    public async emitMessage(msg: string): Promise<boolean> {
      if (!this._producerChannel) {
        logger.warn(`${this.constructor.name}::emitMessage producer channel is not ready yet...`);
        return false;
      }

      const opts = { persistent: true };
      logger.debug(`${this.constructor.name} publish to queue: ${this._producerQueue}, msg=${msg}`);
      return this._producerChannel.sendToQueue(this._producerQueue, Buffer.from(msg), opts);
    }

    /*protected*/ public async setupProducer(options: Options.Connect): Promise<void> {
      if (!this._producerQueue) {
        logger.warn(`${this.constructor.name} has empty queue name. Just skip setup connection...`);
        return;
      }

      try {
        const connection = await amqp.connect(options);
        this._producerChannel = await connection.createChannel();
        const opts = { durable: true };
        await this._producerChannel.assertQueue(this._producerQueue, opts);
      } catch (e) {
        throw new Error(e.message);
      }
    }
  };
}

export default BaseMQProducer;
