import serverless from 'serverless-http';
import { app } from '../../server/app.js';

// Serverless function handler wrapping the Express backend for Netlify
export const handler = serverless(app);
