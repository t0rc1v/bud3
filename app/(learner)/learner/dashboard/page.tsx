export default function LearnerDashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome, Learner!</h2>
        <p className="text-gray-600">
          Access your courses, track your progress, and continue your learning journey.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">My Courses</h3>
          <p className="text-sm text-gray-600 mb-4">Access your enrolled courses</p>
          <button className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            View Courses
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Progress</h3>
          <p className="text-sm text-gray-600 mb-4">Track your learning progress</p>
          <button className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            View Progress
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Resources</h3>
          <p className="text-sm text-gray-600 mb-4">Access learning materials</p>
          <button className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Browse Resources
          </button>
        </div>
      </div>
    </div>
  );
}
