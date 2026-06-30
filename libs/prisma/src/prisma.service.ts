// apps/auth-service/src/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {

    constructor() {
        console.log("URL", process.env.DATABASE_URL)
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        const adapter = new PrismaPg({
            connectionString,
        });

        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
        console.log('✅ Connected to PostgreSQL');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        console.log('Disconnected from PostgreSQL');
    }
}