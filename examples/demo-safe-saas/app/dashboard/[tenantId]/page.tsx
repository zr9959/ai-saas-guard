import Image from "next/image";
import Link from "next/link";

export default function TenantDashboard() {
  return (
    <>
      <Image src="https://cdn.example.com/logo.png" width={240} height={120} alt="" />
      <Link prefetch={false} href="/dashboard/settings">Open settings</Link>
    </>
  );
}
