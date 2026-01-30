import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const resolvePath = (alias) => {
  const paths = {
    '@': resolve(__dirname, '../'),
    '@controllers': resolve(__dirname, '../controllers'),
    '@services': resolve(__dirname, '../services'),
    '@models': resolve(__dirname, '../models'),
    '@utils': resolve(__dirname, '../utils'),
    '@config': resolve(__dirname, '../config'),
    '@middleware': resolve(__dirname, '../middleware'),
  };

  return paths[alias] || alias;
};
