"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { updateUserRole } from "@/lib/actions/auth";
import type { UserRole } from "@/lib/types";

const EDUCATION_LEVELS = [
  "Pre-school",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "University Year 1", "University Year 2", "University Year 3", "University Year 4+",
  "Postgraduate",
  "Other"
];

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Institution fields for super_admin role
  const [institutionName, setInstitutionName] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  
  // Regular user fields
  const [userName, setUserName] = useState("");
  const [userLevel, setUserLevel] = useState("");

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setError(null);
  };

  const handleContinue = async () => {
    if (!selectedRole || !user) return;

    setIsLoading(true);
    setError(null);

    try {
      // For super_admin role, validate institution fields
      if (selectedRole === "super_admin") {
        if (!institutionName.trim()) {
          setError("Institution name is required for super admin accounts");
          setIsLoading(false);
          return;
        }
      }
      
      // For regular role, validate name and level fields
      if (selectedRole === "regular") {
        if (!userName.trim()) {
          setError("Please enter your name");
          setIsLoading(false);
          return;
        }
        if (!userLevel) {
          setError("Please select your education level");
          setIsLoading(false);
          return;
        }
      }

      const userData = selectedRole === "super_admin" ? {
        institutionName: institutionName.trim(),
        institutionType: institutionType.trim() || undefined,
      } : selectedRole === "regular" ? {
        name: userName.trim(),
        level: userLevel,
      } : undefined;

      await updateUserRole(
        user.id, 
        selectedRole, 
        userData
      );

      // Redirect based on role (no verification needed)
      if (selectedRole === "super_admin") {
        router.push("/super-admin");
      } else if (selectedRole === "regular") {
        router.push("/regular");
      }
    } catch (err) {
      setError("Failed to set role. Please try again.");
      console.error("Error updating role:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-foreground">Please sign in first</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card text-card-foreground rounded-2xl shadow-lg border p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome!
          </h1>
          <p className="text-muted-foreground">
            Choose how you want to use the platform
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {/* Institution/Super Admin Option */}
          <button
            onClick={() => handleRoleSelect("super_admin")}
            className={`w-full p-6 rounded-xl border-2 transition-all duration-200 text-left ${
              selectedRole === "super_admin"
                ? "border-blue-500 bg-blue-500/10"
                : "border-border hover:border-blue-400 hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Institution / Organization</h3>
                <p className="text-sm text-muted-foreground">Create content and manage admins and regular users</p>
              </div>
            </div>
          </button>

          {/* Regular User Option */}
          <button
            onClick={() => handleRoleSelect("regular")}
            className={`w-full p-6 rounded-xl border-2 transition-all duration-200 text-left ${
              selectedRole === "regular"
                ? "border-green-500 bg-green-500/10"
                : "border-border hover:border-green-400 hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Individual User</h3>
                <p className="text-sm text-muted-foreground">Access resources and use AI learning tools</p>
              </div>
            </div>
          </button>
        </div>

        {/* Institution Details Form - Only show for super_admin role */}
        {selectedRole === "super_admin" && (
          <div className="mb-8 space-y-4">
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <h4 className="font-semibold text-blue-500 mb-3">Institution Details</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Fill in your institution details to get started as a Super Admin.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Institution Name *
                  </label>
                  <input
                    type="text"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="e.g., ABC High School"
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Institution Type
                  </label>
                  <select
                    value={institutionType}
                    onChange={(e) => setInstitutionType(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type...</option>
                    <option value="school">School (K-12)</option>
                    <option value="university">University / College</option>
                    <option value="private_tutor">Private Tutoring</option>
                    <option value="corporate">Corporate Training</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Regular User Details Form - Only show for regular role */}
        {selectedRole === "regular" && (
          <div className="mb-8 space-y-4">
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <h4 className="font-semibold text-green-500 mb-3">Your Details</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Please provide your name and education level to personalize your experience.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    What name would you like to go by? *
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    What is your education level? *
                  </label>
                  <select
                    value={userLevel}
                    onChange={(e) => setUserLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select your education level...</option>
                    {EDUCATION_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select the education level that best describes your current learning stage
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selectedRole || isLoading}
          className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 ${
            selectedRole && !isLoading
              ? "bg-primary hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              Setting up...
            </span>
          ) : "Continue"}
        </button>
      </div>
    </div>
  );
}
