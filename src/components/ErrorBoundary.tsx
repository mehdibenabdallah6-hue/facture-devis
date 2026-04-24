import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-surface text-on-surface p-6">
          <div className="bg-error-container text-on-error-container p-6 rounded-2xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Une erreur est survenue</h2>
            <p className="text-sm opacity-80 mb-4">
              {this.state.error?.message || 'Erreur inconnue'}
            </p>
            <button
              className="bg-error text-on-error px-4 py-2 rounded-xl font-medium"
              onClick={() => window.location.reload()}
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
