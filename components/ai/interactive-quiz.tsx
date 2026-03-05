"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Send,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Trophy,
  AlertCircle,
} from "lucide-react";

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  number: number;
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer" | "fill_in_blank";
  text: string;
  options: QuizOption[];
  marks: number;
  explanation: string | null;
  hint: string | null;
}

interface QuizSettings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showCorrectAnswerImmediately: boolean;
  showExplanation: boolean;
  allowRetake: boolean;
  timeLimit: number | null;
  passingScore: number;
  maxAttempts: number | null;
}

interface QuizValidationAnswer {
  id: string;
  correctAnswer: unknown;
  marks: number;
}

interface QuizData {
  metadata: {
    title: string;
    subject: string;
    description?: string;
    createdAt: string;
    questionCount: number;
    totalMarks: number;
    passingMarks: number;
    passingScore: number;
  };
  quiz: {
    title: string;
    subject: string;
    description?: string;
    instructions: string;
    settings: QuizSettings;
    questions: QuizQuestion[];
    validation: {
      answers: QuizValidationAnswer[];
    };
  };
}

interface InteractiveQuizProps {
  data: QuizData;
}

type QuizState = "not-started" | "in-progress" | "completed";

interface Answer {
  questionId: string;
  value: string | string[];
  isCorrect?: boolean;
}

export function InteractiveQuiz({ data }: InteractiveQuizProps) {
  const [quizState, setQuizState] = useState<QuizState>("not-started");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    data.quiz.settings.timeLimit ? data.quiz.settings.timeLimit * 60 : null
  );
  const [showResults, setShowResults] = useState(false);

  const questions = data.quiz.questions;
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;

  // Calculate score
  const calculateScore = useCallback(() => {
    let correctCount = 0;
    let totalMarks = 0;
    let earnedMarks = 0;

    questions.forEach((question) => {
      const answer = answers[question.id];
      const validation = data.quiz.validation.answers.find((a) => a.id === question.id);
      
      if (validation && answer) {
        totalMarks += validation.marks;
        const isCorrect = validateAnswer(answer.value, validation.correctAnswer, question.type);
        if (isCorrect) {
          correctCount++;
          earnedMarks += validation.marks;
        }
      }
    });

    const percentage = totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
    const hasPassed = percentage >= data.metadata.passingScore;

    return {
      correctCount,
      totalQuestions: questions.length,
      earnedMarks,
      totalMarks,
      percentage: Math.round(percentage),
      hasPassed,
    };
  }, [answers, questions, data.quiz.validation.answers, data.metadata.passingScore]);

  const validateAnswer = (userAnswer: unknown, correctAnswer: unknown, type: string): boolean => {
    if (type === "multiple_choice" || type === "true_false") {
      return userAnswer === correctAnswer;
    }
    if (type === "short_answer" || type === "fill_in_blank") {
      const userStr = String(userAnswer).toLowerCase().trim();
      const correctStr = String(correctAnswer).toLowerCase().trim();
      return userStr === correctStr || userStr.includes(correctStr) || correctStr.includes(userStr);
    }
    return false;
  };

  const startQuiz = () => {
    setQuizState("in-progress");
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowResults(false);
  };

  const submitQuiz = () => {
    setQuizState("completed");
    setShowResults(true);
  };

  const retakeQuiz = () => {
    if (data.quiz.settings.allowRetake) {
      startQuiz();
    }
  };

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, value },
    }));
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const toggleHint = (questionId: string) => {
    setShowHint((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Get the validation answer for the current question
  const getCurrentValidation = () => {
    return data.quiz.validation.answers.find((a) => a.id === currentQuestion.id);
  };

  // Check if current answer is correct (for immediate feedback)
  const isCurrentAnswerCorrect = () => {
    if (!data.quiz.settings.showCorrectAnswerImmediately) return null;
    
    const answer = answers[currentQuestion.id];
    const validation = getCurrentValidation();
    
    if (!answer || !validation) return null;
    
    return validateAnswer(answer.value, validation.correctAnswer, currentQuestion.type);
  };

  if (quizState === "not-started") {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{data.quiz.title}</CardTitle>
          {data.quiz.description && (
            <CardDescription>{data.quiz.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">{data.metadata.subject}</Badge>
            <Badge variant="secondary">{data.metadata.questionCount} questions</Badge>
            <Badge variant="secondary">{data.metadata.totalMarks} marks</Badge>
            {data.quiz.settings.timeLimit && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {data.quiz.settings.timeLimit} minutes
              </Badge>
            )}
            <Badge variant="secondary">Pass: {data.metadata.passingScore}%</Badge>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Instructions:</h3>
            <p className="text-sm whitespace-pre-wrap">{data.quiz.instructions}</p>
          </div>

          <div className="text-center">
            <Button size="lg" onClick={startQuiz}>
              Start Quiz
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showResults && quizState === "completed") {
    const score = calculateScore();
    
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            {score.hasPassed ? (
              <>
                <Trophy className="h-6 w-6 text-yellow-500" />
                Congratulations!
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-primary" />
                Quiz Completed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">
              {score.percentage}%
            </div>
            <p className="text-muted-foreground">
              {score.correctCount} out of {score.totalQuestions} correct
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {score.earnedMarks} / {score.totalMarks} marks
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Your Score</span>
              <span>{score.percentage}%</span>
            </div>
            <Progress value={score.percentage} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>Pass: {data.metadata.passingScore}%</span>
              <span>100%</span>
            </div>
          </div>

          <div className={cn(
            "p-4 rounded-lg text-center",
            score.hasPassed ? "bg-green-50 text-green-700" : "bg-primary/15 text-foreground"
          )}>
            <p className="font-semibold">
              {score.hasPassed ? "You passed!" : "You didn't pass this time."}
            </p>
            <p className="text-sm mt-1">
              {score.hasPassed
                ? "Great job! You've demonstrated good understanding of the material."
                : "Keep practicing! Review the explanations and try again."}
            </p>
          </div>

          {data.quiz.settings.allowRetake && (
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setShowResults(false)}>
                Review Answers
              </Button>
              <Button onClick={retakeQuiz} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Retake Quiz
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Review mode (after completion)
  if (quizState === "completed" && !showResults) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Review Your Answers</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowResults(true)}>
              Back to Results
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-6">
              {questions.map((question, index) => {
                const answer = answers[question.id];
                const validation = data.quiz.validation.answers.find((a) => a.id === question.id);
                const isCorrect = validation && answer
                  ? validateAnswer(answer.value, validation.correctAnswer, question.type)
                  : false;

                return (
                  <div key={question.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-2 mb-3">
                      {isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">
                          {index + 1}. {question.text}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          ({validation?.marks || question.marks} marks)
                        </p>
                      </div>
                    </div>

                    <div className="ml-7 space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Your answer: </span>
                        <span className={isCorrect ? "text-green-600" : "text-red-600"}>
                          {answer ? String(answer.value) : "Not answered"}
                        </span>
                      </div>

                      {!isCorrect && validation && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Correct answer: </span>
                          <span className="text-green-600">
                            {JSON.stringify(validation.correctAnswer)}
                          </span>
                        </div>
                      )}

                      {question.explanation && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          <strong>Explanation:</strong> {question.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  // Quiz in progress
  const currentAnswerCorrect = isCurrentAnswerCorrect();
  const validation = getCurrentValidation();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{data.quiz.title}</CardTitle>
          {data.quiz.settings.timeLimit && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {Math.floor((timeRemaining || 0) / 60)}:{String((timeRemaining || 0) % 60).padStart(2, "0")}
            </Badge>
          )}
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
          <span>
            {Object.keys(answers).length} answered
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="mt-1">
              {currentQuestion.marks} marks
            </Badge>
            <p className="text-base leading-relaxed">{currentQuestion.text}</p>
          </div>

          {/* Hint button */}
          {currentQuestion.hint && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleHint(currentQuestion.id)}
                className="gap-1 text-muted-foreground"
              >
                <HelpCircle className="h-4 w-4" />
                {showHint[currentQuestion.id] ? "Hide Hint" : "Show Hint"}
              </Button>
            </div>
          )}

          {/* Hint display */}
          {showHint[currentQuestion.id] && currentQuestion.hint && (
            <div className="bg-primary/15 border border-primary/60 rounded-lg p-3 text-sm text-foreground">
              <strong>Hint:</strong> {currentQuestion.hint}
            </div>
          )}

          {/* Multiple Choice / True-False */}
          {(currentQuestion.type === "multiple_choice" || currentQuestion.type === "true_false") && (
            <RadioGroup
              value={answers[currentQuestion.id]?.value as string}
              onValueChange={(value: string) => handleAnswer(currentQuestion.id, value)}
              className="space-y-2"
            >
              {currentQuestion.options.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    "flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-colors",
                    answers[currentQuestion.id]?.value === option.id && "border-primary bg-primary/5",
                    currentAnswerCorrect !== null &&
                      answers[currentQuestion.id]?.value === option.id &&
                      currentAnswerCorrect &&
                      "border-green-500 bg-green-50",
                    currentAnswerCorrect !== null &&
                      answers[currentQuestion.id]?.value === option.id &&
                      !currentAnswerCorrect &&
                      "border-red-500 bg-red-50"
                  )}
                  onClick={() => handleAnswer(currentQuestion.id, option.id)}
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                    {option.text}
                  </Label>
                  {currentAnswerCorrect !== null &&
                    answers[currentQuestion.id]?.value === option.id &&
                    (currentAnswerCorrect ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ))}
                </div>
              ))}
            </RadioGroup>
          )}

          {/* Short Answer / Fill in the Blank */}
          {(currentQuestion.type === "short_answer" || currentQuestion.type === "fill_in_blank") && (
            <div className="space-y-2">
              <Textarea
                value={(answers[currentQuestion.id]?.value as string) || ""}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                placeholder="Type your answer here..."
                className={cn(
                  "min-h-[100px]",
                  currentAnswerCorrect !== null &&
                    answers[currentQuestion.id]?.value &&
                    (currentAnswerCorrect ? "border-green-500" : "border-red-500")
                )}
              />
              {currentAnswerCorrect !== null && answers[currentQuestion.id]?.value && (
                <div
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    currentAnswerCorrect ? "text-green-600" : "text-red-600"
                  )}
                >
                  {currentAnswerCorrect ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Correct!
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Incorrect. Correct answer: {JSON.stringify(validation?.correctAnswer)}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Explanation (shown if immediate feedback is enabled and answered) */}
          {data.quiz.settings.showExplanation &&
            currentAnswerCorrect !== null &&
            currentQuestion.explanation && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <strong>Explanation:</strong> {currentQuestion.explanation}
              </div>
            )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between pt-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={goToPreviousQuestion}
            disabled={currentQuestionIndex === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={goToNextQuestion}
            disabled={currentQuestionIndex === totalQuestions - 1}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          {currentQuestionIndex === totalQuestions - 1 ? (
            <Button
              onClick={submitQuiz}
              disabled={Object.keys(answers).length === 0}
              className="gap-1"
            >
              <Send className="h-4 w-4" />
              Submit Quiz
            </Button>
          ) : (
            <Button onClick={goToNextQuestion} className="gap-1">
              Next Question
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
