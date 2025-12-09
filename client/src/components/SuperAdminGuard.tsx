import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface SuperAdminGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

export function SuperAdminGuard({ children, redirectTo = "/dashboard" }: SuperAdminGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role !== "super_admin") {
    return <Redirect to={redirectTo} />;
  }

  return <>{children}</>;
}

export function TenantAdminGuard({ children, redirectTo = "/dashboard" }: SuperAdminGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role !== "tenant_admin" && user.role !== "super_admin") {
    return <Redirect to={redirectTo} />;
  }

  return <>{children}</>;
}
