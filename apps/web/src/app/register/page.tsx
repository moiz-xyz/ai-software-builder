import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { PlatformShell } from '@/components/shell';

export default function RegisterPage() {
  return <PlatformShell><Suspense><AuthForm mode="register" /></Suspense></PlatformShell>;
}
