import { Pool } from "pg";

import type { V2Data } from "./types";

export async function readV2(connectionString: string): Promise<V2Data> {
  const pool = new Pool({ connectionString });
  const read = async <T>(table: string) => {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
    return rows as T[];
  };

  try {
    return {
      admins: await read("admins"),
      permissions: await read("permissions"),
      adminPermissions: await read("admin_permissions"),
      events: await read("events"),
      attributes: await read("attributes"),
      blocks: await read("blocks"),
      forms: await read("forms"),
      formDefinitions: await read("form_definitions"),
      emails: await read("emails"),
      participants: await read("participants"),
      participantAttributes: await read("participant_attributes"),
      participantEmails: await read("participant_emails"),
    };
  } finally {
    await pool.end();
  }
}
