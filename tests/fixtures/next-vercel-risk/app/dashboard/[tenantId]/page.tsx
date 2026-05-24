import Link from "next/link";
import Image from "next/image";

export default function TenantDashboard({ tenant, invoice }) {
  return (
    <>
      <Image src={tenant.logoUrl} width={240} height={120} alt="" />
      <Link href={`/dashboard/${tenant.id}/invoices/${invoice.id}`}>Open invoice</Link>
      <script>{`window.analyticsKey = "${process.env.NEXT_PUBLIC_ANALYTICS_ID}"`}</script>
    </>
  );
}
