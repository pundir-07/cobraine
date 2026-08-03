import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { pool } from '../../lib/postgres';

export const createPlanTool = (telegramId: number) => tool(
    async ({ title, description, recurrence, importance }) => {
        const userRes = await pool.query(
            `SELECT id FROM users WHERE telegram_id = $1`,
            [telegramId]
        );
        if (userRes.rowCount === 0) {
            return "User not found.";
        }
        const userId = userRes.rows[0].id;

        const planRes = await pool.query(
            `INSERT INTO plans (user_id, title, description, recurrence, importance)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [userId, title, description, recurrence, importance]
        );

        return `Plan created successfully with ID: ${planRes.rows[0].id}`;
    },
    {
        name: 'create_plan',
        description: 'Create a new plan for the user in the database.',
        schema: z.object({
            title: z.string().describe('The title of the plan'),
            description: z.string().optional().describe('Description of the plan'),
            recurrence: z.enum(['single', 'daily', 'weekly', 'monthly']).describe('Recurrence of the plan'),
            importance: z.enum(['high', 'medium', 'low']).describe('Importance of the plan'),
        }),
    }
);

export const createCheckpointTool = tool(
    async ({ planId, title, description, initialTargetTime, nextTargetTime }) => {
        const checkRes = await pool.query(
            `INSERT INTO checkpoints (plan_id, title, description, initial_target_time, next_target_time)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [planId, title, description, initialTargetTime, nextTargetTime]
        );

        return `Checkpoint created successfully with ID: ${checkRes.rows[0].id}. Don't forget to schedule a reminder for this checkpoint if needed!`;
    },
    {
        name: 'create_checkpoint',
        description: 'Create a new checkpoint for an existing plan.',
        schema: z.object({
            planId: z.string().describe('The ID of the plan this checkpoint belongs to'),
            title: z.string().describe('Title of the checkpoint'),
            description: z.string().optional().describe('Description of the checkpoint'),
            initialTargetTime: z.string().describe('ISO string of the initial target time'),
            nextTargetTime: z.string().describe('ISO string of the next target time'),
        }),
    }
);
