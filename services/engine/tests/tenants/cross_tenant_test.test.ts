import {
  describe,
  it,
  beforeEach,
  expect,
  beforeAll,
  afterEach,
  afterAll,
} from "vitest";
import { MerchantsTable } from "../../src/schema/merchants.schema";
import { app } from "../../src/app";
import request from "supertest";
import { drizzle } from "drizzle-orm/node-postgres";
import { PlansTable } from "../../src/schema/plans.schema";
import { CustomersTable } from "../../src/schema/customers.schema";
import { PaymentMethodsTable } from "../../src/schema/payment_methods.schema";
import { SubscriptionsTable } from "../../src/schema/subscriptions.schema";
import { InvoicesTable } from "../../src/schema/invoices.schema";
import { eq, inArray } from "drizzle-orm";

const myOwndb = drizzle(process.env.DATABASE_URL!);
type Tables = typeof CustomersTable | typeof PaymentMethodsTable | typeof InvoicesTable | typeof SubscriptionsTable | typeof PlansTable;
type Dependency = [string, Tables];
type FactoryReturnType = {
  createdId: string;
  dependencies: Dependency[];
}

const tenantScopedResources = [
  { endpoint: "/internal/v1/plans", resourceType: "plan" },
  { endpoint: "/internal/v1/customers", resourceType: "customer" },
  { endpoint: "/internal/v1/subscriptions", resourceType: "subscription" },
  { endpoint: "/internal/v1/invoices", resourceType: "invoice" },
  { endpoint: "/internal/v1/payment-methods", resourceType: "payment_method" },
];

async function createTestMerchant(name: string, email: string) {
  const [merchant] = await myOwndb
    .insert(MerchantsTable)
    .values({
      name: name,
      email: email,
      company: "merchant company",
      password_hash: "hash123",
    })
    .returning();

  return merchant;
}

async function createPlan(merchant: typeof MerchantsTable.$inferSelect): Promise<FactoryReturnType> {
  const [plan] = await myOwndb
    .insert(PlansTable)
    .values({
      name: "some plan",
      amount: 3000,
      interval: "monthly",
      interval_count: 3,
      merchant_id: merchant.id,
    })
    .returning();

  if (!plan) throw new Error(`createPlan failed`);
  return { createdId: plan.id, dependencies: [] };
}

async function createCustomer(merchant: typeof MerchantsTable.$inferSelect): Promise<FactoryReturnType> {
  const [customer] = await myOwndb
    .insert(CustomersTable)
    .values({
      email: "customer_email@gmail.com",
      merchant_id: merchant.id,
      name: "customer",
    })
    .returning();
  if (!customer) throw new Error("createCustomer failed");
  return { createdId: customer.id, dependencies: [] };
}

async function createPaymentMethod(
  merchant: typeof MerchantsTable.$inferSelect,
): Promise<FactoryReturnType> {
  const { createdId: customerId, dependencies: cusDep } =
    await createCustomer(merchant);

  const [paymentMethod] = await myOwndb
    .insert(PaymentMethodsTable)
    .values({
      customer_id: customerId,
      merchant_id: merchant.id,
      nomba_token: "nomba 1234",
      type: "card",
      is_default: true,
      brand: "some branch",
      last4: "1234",
      exp_month: "january",
      exp_year: "2027",
    })
    .returning();

  return {
    createdId: paymentMethod.id,
    dependencies: [[customerId, CustomersTable], ...cusDep],
  };
}

async function createSubscription(
  merchant: typeof MerchantsTable.$inferSelect,
): Promise<FactoryReturnType> {
  const { createdId: customerId, dependencies: cusDep } =
    await createCustomer(merchant);
  const { createdId: planId, dependencies: planDep } =
    await createPlan(merchant);

  const [subscription] = await myOwndb
    .insert(SubscriptionsTable)
    .values({
      merchant_id: merchant.id,
      plan_id: planId,
      customer_id: customerId,
      current_period_start: new Date(),
      current_period_end: new Date(new Date().getMonth() + 1),
    })
    .returning();
  return {
    createdId: subscription.id,
    dependencies: [
      [customerId, CustomersTable],
      [planId, PlansTable],
      ...planDep,
      ...cusDep,
    ],
  };
}

async function createInvoice(merchant: typeof MerchantsTable.$inferSelect): Promise<FactoryReturnType> {
  const { createdId: subscriptionId, dependencies: subDep } =
    await createSubscription(merchant);

  const [invoice] = await myOwndb.insert(InvoicesTable).values({
    merchant_id: merchant.id,
    subscription_id: subscriptionId,
    amount_paid: '3000',
    amount: '3000',
    due_date: new Date(),
  }).returning();
  if(!invoice) throw new Error("createInvoice failed");

  return {
    createdId: invoice.id,
    dependencies: [[subscriptionId, SubscriptionsTable], ...subDep],
  };
}

const resourceFactories: Record<
  string,
  (merchant: typeof MerchantsTable.$inferSelect) => Promise<FactoryReturnType>
> = {
  plan: createPlan,
  customer: createCustomer,
  payment_method: createPaymentMethod,
  subscription: createSubscription,
  invoice: createInvoice,
};

const dependencies = {
  plan: PlansTable,
  customer: CustomersTable,
  payment_method: PaymentMethodsTable,
  subscription: SubscriptionsTable,
  invoice: InvoicesTable,
};

describe.each(tenantScopedResources)(
  "cross-tenant isolation: $resourceType",
  ({ endpoint, resourceType }: { endpoint: string; resourceType: string }) => {
    let merchantA: typeof MerchantsTable.$inferSelect;
    let merchantB: typeof MerchantsTable.$inferSelect;
    let resourceId: string;
    let testDependencies: Dependency[] = [];

    beforeAll(async () => {
      merchantA = await createTestMerchant("merchant a", "merchanta@gmail.com");
      merchantB = await createTestMerchant("merchant b", "merchantb@gmail.com");
    });

    beforeEach(async () => {
      const result = await resourceFactories[resourceType](merchantA);
      resourceId = result.createdId;
      testDependencies = result.dependencies;
    });

    afterEach(async () => {
      const table = dependencies[resourceType as keyof typeof dependencies];
      await myOwndb.delete(table).where(eq(table.id, resourceId));

      for (const d of testDependencies) {
        const depTable = d[1];
        await myOwndb.delete(depTable).where(eq(depTable.id, d[0]));
      }

      testDependencies = [];
    });

    afterAll(async () => {
      await myOwndb
        .delete(MerchantsTable)
        .where(inArray(MerchantsTable.id, [merchantA.id, merchantB.id]));
    });

    it("returns 404 when Merchant B reads Merchant A's resource", async () => {
      const res = await request(app)
        .get(`${endpoint}/${resourceId}`)
        .set("Authorization", `Bearer sk_test_mockmerchantb`)
        .set("x-internal-auth", process.env.INTERNAL_AUTH_SECRET!)
        .set("x-merchant-id", merchantB.id);
      expect(res.status).toBe(404);
    });
  },
);
