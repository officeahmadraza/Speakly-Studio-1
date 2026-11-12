import serverless from 'serverless-http';
import { app } from '../../server.js';

// Serverless function handler wrapping the Express backend for Netlify
export const handler = serverless(app);
