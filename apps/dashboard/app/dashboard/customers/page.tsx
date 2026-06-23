import { PageHeader } from "@/components/shared/page-header";
import { CustomersTable } from "@/components/dashboard/customers/customers-table";
import { CUSTOMERS } from "@/lib/mock-data";

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${CUSTOMERS.length} customers in total`}
      />
      <CustomersTable />
    </div>
  );
}
