import { CreditModal } from "@/components/credits/credit-modal";
import { Users, BookOpen, BarChart3, Coins, CreditCard } from "lucide-react";

export default function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome, Teacher!</h2>
            <p className="text-gray-600">
              Manage your learners and create educational content from your dashboard.
            </p>
          </div>
          <CreditModal />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">My Learners</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">View and manage your learners</p>
          <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            View Learners
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Content</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Create and manage educational content</p>
          <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Manage Content
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Track learner progress and engagement</p>
          <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            View Analytics
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Credits</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Purchase credits for AI assistance</p>
          <CreditModal trigger={
            <button className="w-full py-2 px-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2">
              <CreditCard className="h-4 w-4" />
              Buy Credits
            </button>
          } />
        </div>
      </div>
    </div>
  );
}
