import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ArrowLeft, ArrowRight, Check, Store, Mail, Phone, MapPin, User, Lock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface RegistrationData {
  shopName: string;
  email: string;
  phoneNumber: string;
  fullName: string;
  location: string;
  username: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, isAuthenticated, clearError } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<RegistrationData>({
    shopName: '',
    email: '',
    phoneNumber: '',
    fullName: '',
    location: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const steps = [
    { title: 'Welcome', icon: Store, description: 'Tell us about your shop' },
    { title: 'Contact', icon: Mail, description: 'Your contact information' },
    { title: 'Business', icon: MapPin, description: 'Business details' },
    { title: 'Account', icon: User, description: 'Create your account' },
    { title: 'Success', icon: Check, description: 'All set!' },
  ];

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/shop');
    }
  }, [isAuthenticated, navigate]);

  // Handle successful registration
  useEffect(() => {
    if (!isLoading && !error && isAuthenticated) {
      setCurrentStep(4); // Success step
    }
  }, [isLoading, error, isAuthenticated]);

  // Handle registration errors - navigate to appropriate step
  useEffect(() => {
    if (error && !isLoading) {
      // Map error messages to the step where the issue occurred
      if (error.includes('Shop name already exists')) {
        setCurrentStep(0); // Go back to shop name step
      } else if (error.includes('Username already exists')) {
        setCurrentStep(3); // Go back to account creation step
      } else if (error.includes('Email already exists') || error.includes('Phone number already exists')) {
        setCurrentStep(1); // Go back to contact info step
      }
      // For other errors, stay on current step
    }
  }, [error, isLoading]);

  const updateFormData = (field: keyof RegistrationData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear any existing errors when user starts typing
    if (error) {
      clearError();
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      await register({
        username: formData.username,
        email: formData.email.trim() || undefined,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        role: 3, // Customer role enum value
        fullName: formData.fullName,
        shopName: formData.shopName,
        location: formData.location,
      });
      // Success is handled by useEffect watching isAuthenticated
    } catch (error) {
      // Error is handled by the auth slice and useEffect watching error
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return formData.shopName.trim().length >= 2;
      case 1:
        return (formData.email.trim().length === 0 || formData.email.includes('@')) && formData.phoneNumber.length >= 10;
      case 2:
        return formData.fullName.trim().length >= 2 && formData.location.trim().length >= 2;
      case 3:
        return formData.username.length >= 3 && formData.password.length >= 6 && formData.password === formData.confirmPassword;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="animate-fade-in-scale space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4 animate-pulse-glow">
                <Store className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to Sales Jana!</h2>
              <p className="text-slate-300">Let's get your shop set up in just a few steps</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Shop Name</label>
                <input
                  type="text"
                  value={formData.shopName}
                  onChange={(e) => updateFormData('shopName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your shop name"
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgb(71, 85, 105)' }}
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="animate-slide-in space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full mb-4 animate-pulse-glow">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Contact Information</h2>
              <p className="text-slate-300">How can we reach you?</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address (Optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="your@email.com"
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgb(71, 85, 105)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => updateFormData('phoneNumber', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="+1 (555) 123-4567"
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgb(71, 85, 105)' }}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="animate-slide-in space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-4 animate-pulse-glow">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Business Details</h2>
              <p className="text-slate-300">Tell us more about your business</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateFormData('fullName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="Your full name"
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgb(71, 85, 105)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => updateFormData('location', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="City, State/Country"
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgb(71, 85, 105)' }}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="animate-slide-in space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-4 animate-pulse-glow">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
              <p className="text-slate-300">Set up your login credentials</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => updateFormData('username', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="Choose a username"
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgb(71, 85, 105)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateFormData('password', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="Create a strong password"
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgb(71, 85, 105)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  placeholder="Confirm your password"
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgb(71, 85, 105)' }}
                />
                {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-red-400 text-sm mt-1 animate-fade-in">Passwords don't match</p>
                )}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="animate-fade-in-scale space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-4 animate-bounce-gentle">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome aboard! 🎉</h2>
            <p className="text-slate-300 text-lg">Your account has been created successfully</p>
            <div className="bg-slate-800/30 rounded-lg p-4 mt-6 animate-fade-in-delayed">
              <p className="text-slate-400 text-sm">You can now log in and start exploring your dashboard</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              return (
                <div key={index} className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isActive ? 'bg-indigo-500 text-white animate-pulse-glow' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-2 transition-colors duration-300 ${
                    isActive ? 'text-indigo-400' : 'text-slate-500'
                  }`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl animate-fade-in">
          {renderStepContent()}

          {/* Error display */}
          {error && currentStep !== 4 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Navigation buttons */}
          {currentStep < 4 && (
            <div className="flex justify-between mt-8">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex items-center px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>

              {currentStep === 3 ? (
                <button
                  onClick={handleSubmit}
                  disabled={!validateCurrentStep() || isLoading}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 disabled:opacity-50 animate-pulse-glow"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create Account
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  disabled={!validateCurrentStep()}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="mt-8">
              <Link
                to="/login"
                className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg transition-all duration-200 animate-pulse-glow"
              >
                <Check className="w-4 h-4 mr-2" />
                Go to Login
              </Link>
            </div>
          )}
        </div>

        {/* Back to login link */}
        {currentStep < 4 && (
          <div className="text-center mt-6">
            <Link
              to="/login"
              className="text-slate-400 hover:text-indigo-400 transition-colors duration-200 text-sm"
            >
              Already have an account? Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;