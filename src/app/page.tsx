'use client'

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import GoogleLoginButton from "../components/GoogleLoginButton";
import BokehBackground from "../components/BokehBackground";

export default function Home() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Redirect authenticated users to calendar
    if (session) {
      redirect('/calendar');
    }
  }, [session]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="font-sans flex items-center justify-center min-h-screen p-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="font-sans text-sm text-gray-600 dark:text-gray-400">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  // Only show login page if user is not authenticated
  return (
    <div className="font-sans flex items-center justify-center min-h-screen p-8 relative overflow-hidden">
      <BokehBackground />
      <div className="relative z-10">
        <GoogleLoginButton />
      </div>
    </div>
  );
}
