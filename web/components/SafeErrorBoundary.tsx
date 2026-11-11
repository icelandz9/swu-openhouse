'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SafeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafeErrorBoundary caught an error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[240px] flex flex-col items-center justify-center p-6 bg-slate-900/90 border border-red-500/20 rounded-2xl text-center backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            {this.props.fallbackTitle || 'คอมโพเนนต์พบข้อขัดข้องชั่วคราว'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            {this.state.error?.message || 'ระบบตรวจพบความผิดปกติและกักกันข้อผิดพลาดไว้'}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs text-slate-200 font-medium rounded-lg border border-slate-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            ลองใหม่อีกครั้ง (Retry)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
