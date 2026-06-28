"use client";

import { PageHeader } from "@/components/shared/page-header";
import { CustomersTable } from "@/components/dashboard/customers/customers-table";
import { useAuth } from "@/lib/auth-context";
import { useApiData } from "@/lib/use-api-data";
import { api, type GatewayCustomer } from "@/lib/api-client";
import { CUSTOMERS, type Customer as MockCustomer } from "@/lib/mock-data";

function toMockCustomer(c: GatewayCustomer): MockCustomer {
  return {
    id: c.id,
    name: c.name ?? c.email.split("@")[0],
    email: c.email,
    phone: c.phone ?? "",
    totalRevenue: 0,
    activeSubscriptions: 0,
    paymentMethods: [],
    createdAt: c.created_at,
  };
}

export default function CustomersPage() {
  const { user } = useAuth();

  const { data: customers } = useApiData({
    fetcher: async (key) => {
      const list = await api.customers.list(key);
      return list.map(toMockCustomer);
    },
    mockData: CUSTOMERS,
    apiKey: user?.apiKey ?? "",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${customers.length} customers in total`}
      />
      <CustomersTable externalCustomers={customers} />
    </div>
  );
}
