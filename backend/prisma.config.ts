import { defineConfig } from '@prisma/config';
import 'dotenv/config'; // This loads your .env file variables

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL, 
  },
});