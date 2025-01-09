import { DataSource, DataSourceOptions } from 'typeorm';

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: '128.199.180.226',
  port: 5433,
  username: 'deiex',
  password: 'youhuo123-',
  database: 'deiex_db',
  synchronize: false,
  logging: true,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/database/migrations/*.ts'],
  ssl: false,
};

export const AppDataSource = new DataSource(dataSourceOptions);

AppDataSource.initialize()
  .then(() => {
    console.log('Data Source has been initialized!');
  })
  .catch((err) => {
    console.error('Error during Data Source initialization', err);
  });
