import { db } from "./db";
import { users } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

const SUPER_ADMIN_EMAIL = "admin@degustapizza.com.br";
const SUPER_ADMIN_PASSWORD = "SuperAdmin2025!";
const SUPER_ADMIN_NOME = "Degusta Pizza Admin";

async function seedSuperAdmin() {
  console.log("Verificando Super Admin...");

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, SUPER_ADMIN_EMAIL))
    .limit(1);

  if (existingUser.length > 0) {
    console.log("Super Admin já existe. Atualizando role...");
    await db
      .update(users)
      .set({ role: "super_admin" })
      .where(eq(users.email, SUPER_ADMIN_EMAIL));
    console.log("Role atualizada para super_admin.");
    return;
  }

  const hashedPassword = await hashPassword(SUPER_ADMIN_PASSWORD);

  const [newUser] = await db
    .insert(users)
    .values({
      email: SUPER_ADMIN_EMAIL,
      password: hashedPassword,
      nome: SUPER_ADMIN_NOME,
      role: "super_admin",
      tenantId: null,
    })
    .returning();

  console.log(`Super Admin criado com sucesso!`);
  console.log(`Email: ${newUser.email}`);
  console.log(`Role: ${newUser.role}`);
  console.log(`ID: ${newUser.id}`);
}

seedSuperAdmin()
  .then(() => {
    console.log("Seed concluído.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Erro ao criar Super Admin:", error);
    process.exit(1);
  });
