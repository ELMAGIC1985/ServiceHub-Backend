import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { corsConfig } from './cors.js';

export const configureMiddleware = (app) => {
  // CORS configuration
  app.use(cors(corsConfig));

  // Body parsing middleware
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: true, limit: '16kb' }));

  // Static files
  app.use(express.static('public'));

  // Cookie parser
  app.use(cookieParser());
};
