"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { getMyDashboardUrl } from "@/lib/actions/auth";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Brain,
  BookOpen,
  Users,
  Sparkles,
  MessageSquare,
  FileText,
  ChevronRight,
  Star,
  BarChart3,
  Shield,
  PlayCircle,
  Coins,
  Lock,
  CreditCard,
  Smartphone,
  Check,
  HelpCircle,
  Wallet,
  ArrowRight,
  Sun,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const features = [
  {
    icon: Brain,
    title: "AI-Powered Learning",
    description:
      "Personalized learning paths adapted to your pace and style with intelligent content recommendations.",
  },
  {
    icon: MessageSquare,
    title: "Smart AI Tutor",
    description:
      "Get instant answers, explanations, and guidance from our advanced AI tutor available 24/7.",
  },
  {
    icon: FileText,
    title: "Rich Resources",
    description:
      "Access comprehensive notes, videos, audio lessons, and interactive quizzes across all subjects.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    description:
      "Monitor your learning journey with detailed analytics and insights into your performance.",
  },
  {
    icon: Users,
    title: "Multi-Role Platform",
    description:
      "Seamless experience for individuals or institutions with role-specific features.",
  },
  {
    icon: Coins,
    title: "Credit System",
    description:
      "Flexible credit-based access to premium content. Pay only for what you use with transparent pricing.",
  },
];

const stats = [
  { value: "10K+", label: "Active Learners" },
  { value: "500+", label: "Expert Teachers" },
  { value: "5K+", label: "Learning Resources" },
  { value: "98%", label: "Satisfaction Rate" },
];

const testimonials = [
  {
    quote:
      "This platform transformed how I study. The AI tutor explains complex concepts in ways I actually understand.",
    author: "Sarah M.",
    role: "High School Student",
  },
  {
    quote:
      "As a teacher, I can focus on what matters most - teaching. The platform handles everything else.",
    author: "Mr. Johnson",
    role: "Mathematics Teacher",
  },
  {
    quote:
      "The best educational investment we've made. Our students' performance improved by 40%.",
    author: "Dr. Williams",
    role: "School Administrator",
  },
];

const creditPackages = [
  { name: "Starter", credits: 50, kes: 100, popular: false },
  { name: "Standard", credits: 150, kes: 300, popular: true },
  { name: "Premium", credits: 500, kes: 1000, popular: false },
  { name: "Ultimate", credits: 1000, kes: 2000, popular: false },
];

function PricingModal() {
  const [activeTab, setActiveTab] = useState<"credits" | "unlock">("credits");

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold text-center">
          <span className="bg-gradient-to-r from-orange-700 to-amber-500 bg-clip-text text-transparent">
            Pricing & Credits
          </span>
        </DialogTitle>
      </DialogHeader>

      <div className="mt-6">
        {/* Tab Navigation */}
        <div className="flex p-1 bg-muted rounded-lg mb-8">
          <button
            onClick={() => setActiveTab("credits")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === "credits"
                ? "bg-background shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Coins className="h-4 w-4" />
            Credit System
          </button>
          <button
            onClick={() => setActiveTab("unlock")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === "unlock"
                ? "bg-background shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="h-4 w-4" />
            Unlock System
          </button>
        </div>

        {activeTab === "credits" ? (
          <div className="space-y-8">
            {/* Credit Explanation */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/15 dark:to-primary/8 rounded-xl p-6 border border-primary/40 dark:border-primary/50">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-700 to-amber-500 shrink-0">
                  <Coins className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">How Credits Work</h3>
                  <p className="text-muted-foreground text-sm">
                    Credits are the currency of BudLM. Use them to unlock premium content and 
                    get AI responses. <span className="font-semibold text-primary">Ksh 100 = 50 credits</span> - use credits to unlock content at custom prices.
                  </p>
                </div>
              </div>
            </div>

            {/* Credit Packages */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Credit Packages</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {creditPackages.map((pkg) => (
                  <div
                    key={pkg.name}
                    className={`relative rounded-xl border-2 p-4 transition-all ${
                      pkg.popular
                        ? "border-primary/70 bg-primary/10 dark:bg-primary/15"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-700 text-white text-xs font-medium px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{pkg.name}</span>
                      <div className="flex items-center gap-1 text-primary">
                        <Coins className="h-4 w-4" />
                        <span className="font-bold">{pkg.credits}</span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold">Ksh {pkg.kes}</span>
                      <span className="text-sm text-muted-foreground">
                        ({pkg.credits} credits)
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-4">
                      ~Varies by content price
                    </div>
                    <Button
                      className={`w-full ${
                        pkg.popular
                          ? "bg-gradient-to-r from-orange-700 to-amber-500 hover:from-orange-800 hover:to-amber-600"
                          : ""
                      }`}
                      variant={pkg.popular ? "default" : "outline"}
                    >
                      Purchase
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-muted rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Pay with M-Pesa
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                We use M-Pesa for all transactions. Simply enter your phone number and 
                approve the payment request on your phone. Secure, fast, and convenient.
              </p>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" />
                  <span>Instant credits</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" />
                  <span>No hidden fees</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Unlock Explanation */}
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shrink-0">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Content Unlock System</h3>
                  <p className="text-muted-foreground text-sm">
                    Premium educational content is locked until you unlock it. Once unlocked, 
                    the content is yours forever. Use credits or pay directly via M-Pesa to unlock.
                  </p>
                </div>
              </div>
            </div>

            {/* How Unlocking Works */}
            <div>
              <h3 className="font-semibold text-lg mb-4">How Content Unlocking Works</h3>
              <div className="space-y-4">
                {[
                  {
                    icon: BookOpen,
                    title: "Browse Content",
                    description: "Explore subjects, topics, and resources organized by level",
                  },
                  {
                    icon: Lock,
                    title: "Find Locked Resources",
                    description: "Premium content is marked with a lock icon and shows the unlock fee",
                  },
                  {
                    icon: Wallet,
                    title: "Choose Payment Method",
                    description: "Use your credits or pay directly via M-Pesa - prices vary by content",
                  },
                  {
                    icon: Check,
                    title: "Access Forever",
                    description: "Once unlocked, the resource is permanently available in your library",
                  },
                ].map((step, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 dark:bg-primary/15 shrink-0">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{step.title}</h4>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Unlock Pricing */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-primary/40 dark:border-primary/50 p-6 bg-primary/10 dark:bg-primary/8">
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Pay with Credits</h4>
                </div>
                <div className="text-3xl font-bold text-primary mb-1">Custom Pricing</div>
                <p className="text-sm text-muted-foreground mb-4">
                  Price varies per content (e.g., 30-100 credits)
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Instant unlock
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">Ksh 100 = 50 credits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Best for frequent users
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 p-6 bg-amber-50/30 dark:bg-amber-950/10">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone className="h-5 w-5 text-amber-600" />
                  <h4 className="font-semibold">Pay with M-Pesa</h4>
                </div>
                <div className="text-3xl font-bold text-amber-600 mb-1">Custom Pricing</div>
                <p className="text-sm text-muted-foreground mb-4">
                  Price varies per content (e.g., Ksh 60-200)
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Direct payment
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    No credit purchase needed
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Perfect for one-time access
                  </li>
                </ul>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="bg-muted rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-1">What happens after I unlock content?</h4>
                  <p className="text-muted-foreground">
                    The content becomes permanently available in your library. You can access it 
                    anytime without additional payment.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Do teachers also need to pay to unlock content?</h4>
                  <p className="text-muted-foreground">
                    Yes, the unlock system applies to all users including teachers. This ensures 
                    fair compensation for content creators.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Can I get a refund?</h4>
                  <p className="text-muted-foreground">
                    Credits are non-refundable once used. However, if you encounter technical issues, 
                    please contact our support team.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Is there a minimum credit purchase?</h4>
                  <p className="text-muted-foreground">
                    Yes, the minimum purchase is Ksh 100 which gives you 50 credits. Content unlock prices vary based on the specific resource.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-8 pt-6 border-t flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Questions? Contact our support team
          </div>
          <Link href="/sign-up">
            <Button className="bg-gradient-to-r from-orange-700 to-amber-500 hover:from-orange-800 hover:to-amber-600">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </DialogContent>
  );
}

export default function LandingPage() {
  const { isSignedIn } = useUser();
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      getMyDashboardUrl().then(setDashboardUrl);
    }
  }, [isSignedIn]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            {/* <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-700 to-amber-500 shadow-lg shadow-orange-700/20">
              <Sun className="h-5 w-5 text-white" />
            </div> */}
            <span className="text-xl font-bold bg-gradient-to-r from-orange-800 to-amber-600 bg-clip-text text-transparent">
              BudLM
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Testimonials
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                size="sm"
                className="bg-gradient-to-r from-orange-700 to-amber-500 hover:from-orange-800 hover:to-amber-600"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-orange-600 opacity-20 blur-[100px]" />
          <div className="absolute right-0 top-0 -z-10 h-[400px] w-[400px] rounded-full bg-amber-400 opacity-20 blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="mx-auto max-w-4xl text-center"
          >
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm font-medium mb-8"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>AI-Powered Education Platform</span>
              <ChevronRight className="h-4 w-4" />
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl mb-6"
            >
              Learn Smarter with{" "}
              <span className="bg-gradient-to-r from-orange-700 to-amber-500 bg-clip-text text-transparent">
                AI-Powered
              </span>{" "}
              Education
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl mb-10"
            >
              Personalized learning experiences, intelligent tutoring, and comprehensive
              resources for students, teachers, and institutions.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {dashboardUrl ? (
                <Link href={dashboardUrl}>
                  <Button
                    size="lg"
                    className="h-12 px-8 bg-gradient-to-r from-orange-700 to-amber-500 hover:from-orange-800 hover:to-amber-600 text-white shadow-lg shadow-orange-700/25"
                  >
                    Go to Dashboard
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="h-12 px-8 bg-gradient-to-r from-orange-700 to-amber-500 hover:from-orange-800 hover:to-amber-600 text-white shadow-lg shadow-orange-700/25"
                  >
                    Start Learning Free
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="#how-it-works">
                <Button variant="outline" size="lg" className="h-12 px-8">
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Watch Demo
                </Button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInUp}
              className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4"
            >
              {stats.map((stat, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className="text-3xl font-bold text-foreground sm:text-4xl">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-orange-700 to-amber-500 bg-clip-text text-transparent">
                Excel
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Comprehensive tools and features designed for modern education
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="group relative overflow-hidden border bg-background transition-all hover:shadow-lg hover:-translate-y-1 h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-700/5 to-amber-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                  <CardHeader>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-700 to-amber-500 shadow-lg shadow-orange-700/20">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              How It{" "}
              <span className="bg-gradient-to-r from-orange-700 to-amber-500 bg-clip-text text-transparent">
                Works
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Get started in minutes with our simple three-step process
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-8 md:grid-cols-3"
          >
            {[
              {
                step: "01",
                title: "Create Account",
                description:
                  "Sign up as a learner, teacher, or institution. Choose your role and get started instantly.",
                icon: Users,
              },
              {
                step: "02",
                title: "Explore Content",
                description:
                  "Browse through thousands of resources organized by level, subject, and topic.",
                icon: BookOpen,
              },
              {
                step: "03",
                title: "Learn with AI",
                description:
                  "Engage with our AI tutor, track progress, and achieve your learning goals faster.",
                icon: Brain,
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="relative flex flex-col items-center text-center"
              >
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-700 to-amber-500 shadow-xl shadow-orange-700/20">
                  <item.icon className="h-10 w-10 text-white" />
                </div>
                <div className="mb-4 text-5xl font-bold text-muted-foreground/20">
                  {item.step}
                </div>
                <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                <p className="text-muted-foreground max-w-xs">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Simple & Transparent{" "}
              <span className="bg-gradient-to-r from-orange-700 to-amber-500 bg-clip-text text-transparent">
                Pricing
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Pay only for what you use. No hidden fees, no subscriptions.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto max-w-4xl"
          >
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Credit Card */}
              <Card className="border-2 border-primary/40 dark:border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/15 dark:to-primary/8">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-700 to-amber-500">
                    <Coins className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Credit System</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    1 credit = 1 AI response or content unlock
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>50 credits for Ksh 100</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Pay with M-Pesa</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Credits expire after 30 days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Unlock Card */}
              <Card className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500">
                    <Lock className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>Content Unlock</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Access premium content with custom pricing
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-600" />
                      <span>Custom pricing per content</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-600" />
                      <span>Pay with credits or M-Pesa</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-600" />
                      <span>Permanent access after unlock</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-600" />
                      <span>All subjects & topics</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CTA Card */}
              <Card className="border-2 border-transparent bg-gradient-to-br from-orange-700 to-amber-500 text-white">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">Get Started</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white/80 mb-4">
                    Learn more about our pricing and start your journey today.
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="secondary"
                        className="w-full bg-white text-primary hover:bg-white/90"
                      >
                        View Full Pricing
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <PricingModal />
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>

      {/* For Different Roles */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Built for{" "}
              <span className="bg-gradient-to-r from-orange-700 to-amber-500 bg-clip-text text-transparent">
                Everyone
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Tailored experiences for every role in the education ecosystem
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto"
          >
            <motion.div variants={fadeInUp}>
              <Card className="border-2 border-transparent hover:border-primary/20 transition-all h-full">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 dark:bg-primary/15">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>For Learners & Individuals</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      Personalized learning paths
                    </li>
                    <li className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      24/7 AI tutoring support
                    </li>
                    <li className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      Easy content creation tools
                    </li>
                    <li className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      Progress tracking & analytics
                    </li>
                  </ul>
                  <Link href="/sign-up" className="mt-6 block">
                    <Button className="w-full" variant="outline">
                      Join as Learner
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="border-2 border-transparent hover:border-yellow-500/20 transition-all h-full">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900/20">
                    <Shield className="h-6 w-6 text-yellow-600" />
                  </div>
                  <CardTitle>For Admins & Institutions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-600" />
                      Comprehensive admin dashboard
                    </li>
                    <li className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-600" />
                      Add & Manage learners/regulars
                    </li>
                    <li className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-600" />
                      Analytics & reporting tools
                    </li>
                    <li className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-600" />
                      Gift credits rewards & contnet unlocks
                    </li>
                  </ul>
                  <Link href="/sign-up" className="mt-6 block">
                    <Button className="w-full" variant="outline">
                      Join as Admin
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Loved by{" "}
              <span className="bg-gradient-to-r from-orange-700 to-amber-500 bg-clip-text text-transparent">
                Thousands
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              See what our users have to say about their experience
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-6 md:grid-cols-3"
          >
            {testimonials.map((testimonial, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="relative overflow-hidden border bg-background h-full">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-orange-700/10 to-amber-500/10" />
                  <CardContent className="pt-6">
                    <div className="mb-4 flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="mb-4 text-muted-foreground">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-700 to-amber-500 text-white font-semibold text-sm">
                        {testimonial.author.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{testimonial.author}</p>
                        <p className="text-xs text-muted-foreground">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-700 via-amber-500 to-yellow-500 px-6 py-16 sm:px-12 sm:py-20 lg:px-16"
          >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:14px_24px]" />
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-4">
                Ready to Transform Your Learning?
              </h2>
              <p className="text-lg text-white/80 mb-8">
                Join thousands of learners, teachers, and institutions already using
                BudLM to achieve their educational goals.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-12 px-8 bg-white text-primary hover:bg-white/90 shadow-lg"
                  >
                    Get Started Free
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-8 border-white text-white hover:bg-white/10"
                  >
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                {/* <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-700 to-amber-500">
                  <Sun className="h-4 w-4 text-white" />
                </div> */}
                <span className="text-lg font-bold bg-gradient-to-r from-orange-800 to-amber-600 bg-clip-text text-transparent">
                  BudLM
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered educational platform for modern learning.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#features" className="hover:text-primary transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="hover:text-primary transition-colors">
                    How it Works
                  </Link>
                </li>
                <li>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="hover:text-primary transition-colors">
                        Pricing
                      </button>
                    </DialogTrigger>
                    <PricingModal />
                  </Dialog>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-primary transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary transition-colors">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary transition-colors">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} BudLM. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
