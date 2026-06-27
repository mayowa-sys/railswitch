import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/mock-data";
import { CustomerDetail } from "@/components/dashboard/customers/customer-detail";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = getCustomerById(id);

  if (!customer) notFound();

  return <CustomerDetail customerId={id} />;
}
