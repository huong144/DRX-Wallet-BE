try {
  const path = require('path');
  require('dotenv-safe').config({
    path: path.resolve(__dirname, '../../.env'),
    example: path.resolve(__dirname, '../../.env.example')
  });
} catch (e) {
  console.error(e.toString());
  process.exit(1);
}

module.exports = {
  type: 'mysql',
  port: process.env.TYPEORM_PORT,
  username: process.env.TYPEORM_USERNAME,
  logging: process.env.TYPEORM_LOGGING ? process.env.TYPEORM_LOGGING === 'true' : true,
  password: process.env.TYPEORM_PASSWORD,
  database: process.env.TYPEORM_DATABASE,
  synchronize: false,
  entities: ['libs/wallet-core/src/entities/**/*'],
  host: process.env.TYPEORM_HOST,
  migrations: ['src/migration/**/*.ts'],
  migrationsTableName: process.env.TYPEORM_MIGRATION_TABLE,
  subscribers: ['src/subscriber/**/*.ts'],
  cli: {
    entitiesDir: 'src/entity',
    migrationsDir: 'src/migration',
    subscribersDir: 'src/subscriber'
  },
  charset: 'utf8mb4'
};
