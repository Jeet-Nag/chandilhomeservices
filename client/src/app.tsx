import { currentLanguage, isLanguageChosen, selectLanguage } from './state/language';
import { isAuthenticated, currentUser } from './state/auth';
import { bookingStep } from './state/booking';
import { selectedJobId } from './state/provider';
import { LoginScreen } from './components/LoginScreen';
import { CustomerHome } from './components/CustomerHome';
import { BookingForm } from './components/BookingForm';
import { BookingReview } from './components/BookingReview';
import { BookingConfirmed } from './components/BookingConfirmed';
import { BookingHistory } from './components/BookingHistory';
import { BookingDetailScreen } from './components/BookingDetailScreen';
import { ProviderHome } from './components/ProviderHome';
import { ProviderJobDetailScreen } from './components/ProviderJobDetailScreen';

export function App() {
  // 1. First-launch Language Selection Screen
  // (Strict requirement: do NOT silently assume Hindi or English on fresh install)
  if (!isLanguageChosen.value) {
    return (
      <div class="min-h-screen flex items-center justify-center p-4 bg-background">
        <div class="w-full max-w-md bg-surface border border-border rounded-lg p-6 shadow-sm">
          <div class="text-center mb-6">
            <h1 class="text-xl font-bold text-brand">Chandil Home Services</h1>
            <h2 class="text-lg font-semibold text-text-main mt-2">
              Choose your language / भाषा चुनें
            </h2>
          </div>

          <div class="space-y-4">
            <button
              onClick={() => selectLanguage('en')}
              class="w-full min-h-[56px] flex items-center justify-between px-5 py-4 border-2 border-border hover:border-brand rounded-lg text-left transition-colors bg-white focus:outline-none focus:border-brand"
            >
              <div>
                <div class="text-base font-bold text-text-main">English</div>
                <div class="text-sm text-text-sub">Continue in English</div>
              </div>
              <span class="text-brand font-bold text-lg">→</span>
            </button>

            <button
              onClick={() => selectLanguage('hi')}
              class="w-full min-h-[56px] flex items-center justify-between px-5 py-4 border-2 border-border hover:border-brand rounded-lg text-left transition-colors bg-white focus:outline-none focus:border-brand"
            >
              <div>
                <div class="text-base font-bold text-text-main">हिंदी</div>
                <div class="text-sm text-text-sub">हिंदी में जारी रखें</div>
              </div>
              <span class="text-brand font-bold text-lg">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State -> Mobile Login Screen
  if (!isAuthenticated.value) {
    return <LoginScreen />;
  }

  // 3. Provider Role Flow
  if (currentUser.value?.role === 'provider') {
    if (selectedJobId.value) {
      return <ProviderJobDetailScreen />;
    }
    return <ProviderHome />;
  }

  // 4. Customer Role Flow (Customer App)
  switch (bookingStep.value) {
    case 'details':
      return <BookingForm />;
    case 'review':
      return <BookingReview />;
    case 'confirmed':
      return <BookingConfirmed />;
    case 'history':
      return <BookingHistory />;
    case 'status':
      return <BookingDetailScreen />;
    case 'home':
    default:
      return <CustomerHome />;
  }
}
