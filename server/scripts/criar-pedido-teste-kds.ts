import { db } from "../db";
import { pedidos, produtos, clientes } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function criarPedidoTesteKDS() {
  try {
    console.log("Iniciando criação de pedido de teste para KDS...");

    // Buscar um tenant existente (pular super admin sem tenant)
    const todosUsuarios = await db.query.users.findMany({ limit: 10 });
    if (todosUsuarios.length === 0) {
      console.error("Nenhum usuário encontrado no banco. Execute o seed primeiro.");
      process.exit(1);
    }
    const usuarioComTenant = todosUsuarios.find(u => u.tenantId);
    if (!usuarioComTenant) {
      console.error("Nenhum usuário com tenant encontrado. Cadastre uma franquia primeiro.");
      process.exit(1);
    }
    const tenantId = usuarioComTenant.tenantId!;
    console.log(`Usando tenantId: ${tenantId}`);

    // Buscar 3 produtos para o pedido
    const produtosDisponiveis = await db
      .select()
      .from(produtos)
      .where(eq(produtos.tenantId, tenantId))
      .limit(3);

    if (produtosDisponiveis.length === 0) {
      console.error("Nenhum produto encontrado. Execute o script popular-cardapio.ts primeiro.");
      process.exit(1);
    }

    console.log(`Produtos selecionados: ${produtosDisponiveis.map(p => p.nome).join(", ")}`);

    // Buscar ou criar um cliente
    let cliente = await db
      .select()
      .from(clientes)
      .where(eq(clientes.tenantId, tenantId))
      .limit(1);

    let clienteId: string | null = null;
    if (cliente.length === 0) {
      console.log("Criando cliente de teste...");
      const [novoCliente] = await db
        .insert(clientes)
        .values({
          tenantId,
          nome: "Cliente Teste KDS",
          telefone: "11999887766",
          email: "teste@kds.com",
          endereco: "Rua Teste, 123",
        })
        .returning();
      clienteId = novoCliente.id;
      console.log(`Cliente criado: ${novoCliente.nome}`);
    } else {
      clienteId = cliente[0].id;
      console.log(`Cliente existente: ${cliente[0].nome}`);
    }

    // Criar itens do pedido no formato correto
    const itens = produtosDisponiveis.map((produto, index) => ({
      produtoId: produto.id,
      nome: produto.nome,
      quantidade: 1,
      precoUnitario: produto.preco ? parseFloat(produto.preco) : 35.0,
      observacoes: index === 0 ? "Sem cebola" : null,
    }));

    const total = itens.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);

    // Criar pedido com itens (não items!)
    const [novoPedido] = await db
      .insert(pedidos)
      .values({
        tenantId,
        clienteId,
        status: "preparando",
        total: total.toFixed(2),
        itens: itens as any, // JSONB field
        observacoes: "Pedido de teste para validar KDS",
        enderecoEntrega: "Rua Teste, 123 - Apto 45",
        origem: "teste_kds",
      })
      .returning();

    console.log("\n✅ Pedido de teste criado com sucesso!");
    console.log(`ID: ${novoPedido.id}`);
    console.log(`Total: R$ ${novoPedido.total}`);
    console.log(`Itens: ${itens.length} pizza(s)`);
    console.log("\n📺 Acesse /kds para ver o pedido na tela KDS");
    console.log("\n🔍 Detalhes dos itens:");
    itens.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.nome} - R$ ${item.precoUnitario.toFixed(2)}`);
      if (item.observacoes) {
        console.log(`     Obs: ${item.observacoes}`);
      }
    });

  } catch (error) {
    console.error("Erro ao criar pedido de teste:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

criarPedidoTesteKDS();
