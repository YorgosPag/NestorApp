'use client';

import { generateJobId, generateOperationId } from '@/services/enterprise-id.service';

// Batch Processing Service for bulk operations
export type BatchOperationType = 'create' | 'update' | 'delete' | 'custom';

export interface BatchOperation<T = any> {
  id: string;
  type: BatchOperationType;
  data: T;
  dependencies?: string[]; // IDs of operations this depends on
  priority?: number; // Higher = more priority
  retries?: number;
  timeout?: number;
}

export interface BatchJob<T = any> {
  id: string;
  name: string;
  operations: BatchOperation<T>[];
  options: BatchProcessingOptions;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  progress: BatchProgress;
  results: BatchOperationResult[];
}

export interface BatchProcessingOptions {
  concurrency?: number; // Max parallel operations
  batchSize?: number; // Operations per batch
  delayBetweenBatches?: number; // ms
  stopOnError?: boolean;
  retryFailedOperations?: boolean;
  maxRetries?: number;
  timeout?: number; // ms per operation
}

export interface BatchProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining?: number;
}

export interface BatchOperationResult {
  operationId: string;
  status: 'success' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  executionTime: number;
  retryCount: number;
}

export interface BatchProcessor {
  execute<T>(operation: BatchOperation<T>): Promise<any>;
}

class BatchProcessingService {
  private static instance: BatchProcessingService;
  private jobs = new Map<string, BatchJob>();
  private processors = new Map<BatchOperationType, BatchProcessor>();
  private activeJobs = new Set<string>();

  static getInstance(): BatchProcessingService {
    if (!BatchProcessingService.instance) {
      BatchProcessingService.instance = new BatchProcessingService();
    }
    return BatchProcessingService.instance;
  }

  // Register processors for different operation types
  registerProcessor(type: BatchOperationType, processor: BatchProcessor): void {
    this.processors.set(type, processor);
  }

  // Create a new batch job
  // 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
  createJob<T>(
    name: string,
    operations: BatchOperation<T>[],
    options: BatchProcessingOptions = {}
  ): string {
    const jobId = generateJobId();
    
    const defaultOptions: BatchProcessingOptions = {
      concurrency: 3,
      batchSize: 10,
      delayBetweenBatches: 100,
      stopOnError: false,
      retryFailedOperations: true,
      maxRetries: 3,
      timeout: 30000
    };

    const job: BatchJob<T> = {
      id: jobId,
      name,
      // 🏢 ENTERPRISE: Using centralized ID generation for missing operation IDs
      operations: operations.map((op) => ({
        ...op,
        id: op.id || generateOperationId(),
        priority: op.priority || 0,
        retries: 0
      })),
      options: { ...defaultOptions, ...options },
      status: 'pending',
      createdAt: Date.now(),
      progress: {
        total: operations.length,
        processed: 0,
        successful: 0,
        failed: 0,
        percentage: 0,
        currentBatch: 0,
        totalBatches: Math.ceil(operations.length / (options.batchSize || defaultOptions.batchSize!))
      },
      results: []
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  // Execute a batch job
  async executeJob(
    jobId: string,
    onProgress?: (progress: BatchProgress) => void
  ): Promise<BatchJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (this.activeJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }

    this.activeJobs.add(jobId);
    job.status = 'running';
    job.startedAt = Date.now();

    try {
      await this.processJob(job, onProgress);
      job.status = job.progress.failed > 0 ? 'failed' : 'completed';
    } catch (error) {
      job.status = 'failed';
      // Error logging removed //('Batch job execution failed:', error);
    } finally {
      job.completedAt = Date.now();
      this.activeJobs.delete(jobId);
      
      // Final progress update
      onProgress?.(job.progress);
    }

    return job;
  }

  private async processJob<T>(
    job: BatchJob<T>,
    onProgress?: (progress: BatchProgress) => void
  ): Promise<void> {
    const { operations, options } = job;
    const startTime = Date.now();

    // Sort operations by priority and handle dependencies
    const sortedOperations = this.sortOperationsByDependencies(operations);
    const batches = this.createBatches(sortedOperations, options.batchSize!);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (job.status === 'cancelled') break;

      job.progress.currentBatch = batchIndex + 1;
      
      const batch = batches[batchIndex];
      await this.processBatch(job, batch, options);

      // Update progress
      this.updateProgress(job, startTime);
      onProgress?.(job.progress);

      // Delay between batches
      if (batchIndex < batches.length - 1 && options.delayBetweenBatches) {
        await this.delay(options.delayBetweenBatches);
      }

      // Stop on error if configured
      if (options.stopOnError && job.progress.failed > 0) {
        break;
      }
    }

    // Retry failed operations if enabled
    if (options.retryFailedOperations && job.progress.failed > 0) {
      await this.retryFailedOperations(job, onProgress);
    }
  }

  private async processBatch<T>(
    job: BatchJob<T>,
    batch: BatchOperation<T>[],
    options: BatchProcessingOptions
  ): Promise<void> {
    const semaphore = new Semaphore(options.concurrency!);
    
    const batchPromises = batch.map(operation => 
      semaphore.acquire().then(async (release) => {
        try {
          const result = await this.executeOperation(operation, options);
          job.results.push(result);
          
          if (result.status === 'success') {
            job.progress.successful++;
          } else {
            job.progress.failed++;
          }
        } finally {
          job.progress.processed++;
          release();
        }
      })
    );

    await Promise.all(batchPromises);
  }

  private async executeOperation<T>(
    operation: BatchOperation<T>,
    options: BatchProcessingOptions
  ): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const processor = this.processors.get(operation.type);
    
    if (!processor) {
      return {
        operationId: operation.id,
        status: 'failed',
        error: `No processor registered for operation type: ${operation.type}`,
        executionTime: 0,
        retryCount: 0
      };
    }

    try {
      // Apply timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), 
                  operation.timeout || options.timeout)
      );

      const operationPromise = processor.execute(operation);
      const result = await Promise.race([operationPromise, timeoutPromise]);

      return {
        operationId: operation.id,
        status: 'success',
        result,
        executionTime: Date.now() - startTime,
        retryCount: operation.retries || 0
      };

    } catch (error) {
      return {
        operationId: operation.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        retryCount: operation.retries || 0
      };
    }
  }

  private async retryFailedOperations<T>(
    job: BatchJob<T>,
    onProgress?: (progress: BatchProgress) => void
  ): Promise<void> {
    const failedResults = job.results.filter(r => r.status === 'failed');
    if (failedResults.length === 0) return;

    const failedOperations = job.operations.filter(op => 
      failedResults.some(r => r.operationId === op.id && 
                         (r.retryCount < (job.options.maxRetries || 3)))
    );

    if (failedOperations.length === 0) return;

    // Reset counters for retry
    job.progress.failed -= failedOperations.length;
    job.progress.processed -= failedOperations.length;

    for (const operation of failedOperations) {
      operation.retries = (operation.retries || 0) + 1;
      
      const result = await this.executeOperation(operation, job.options);
      
      // Update existing result
      const existingResultIndex = job.results.findIndex(r => r.operationId === operation.id);
      if (existingResultIndex >= 0) {
        job.results[existingResultIndex] = result;
      }

      if (result.status === 'success') {
        job.progress.successful++;
      } else {
        job.progress.failed++;
      }
      
      job.progress.processed++;
      this.updateProgress(job, Date.now());
      onProgress?.(job.progress);
    }
  }

  private sortOperationsByDependencies<T>(operations: BatchOperation<T>[]): BatchOperation<T>[] {
    const sorted: BatchOperation<T>[] = [];
    const processed = new Set<string>();
    const remaining = [...operations];

    // Simple topological sort
    while (remaining.length > 0) {
      const canProcess = remaining.filter(op => 
        !op.dependencies || op.dependencies.every(dep => processed.has(dep))
      );

      if (canProcess.length === 0) {
        // Circular dependency or missing dependency - process remaining as-is
        sorted.push(...remaining);
        break;
      }

      // Sort by priority within processable operations
      canProcess.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      const operation = canProcess[0];
      sorted.push(operation);
      processed.add(operation.id);
      
      const index = remaining.indexOf(operation);
      remaining.splice(index, 1);
    }

    return sorted;
  }

  private createBatches<T>(operations: BatchOperation<T>[], batchSize: number): BatchOperation<T>[][] {
    const batches: BatchOperation<T>[][] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private updateProgress(job: BatchJob, startTime: number): void {
    const { progress } = job;
    progress.percentage = Math.round((progress.processed / progress.total) * 100);
    
    // Estimate remaining time
    if (progress.processed > 0) {
      const elapsed = Date.now() - startTime;
      const avgTimePerOperation = elapsed / progress.processed;
      const remaining = progress.total - progress.processed;
      progress.estimatedTimeRemaining = Math.round(remaining * avgTimePerOperation);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Job management methods
  getJob(jobId: string): BatchJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): BatchJob[] {
    return Array.from(this.jobs.values());
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'running') {
      job.status = 'cancelled';
      return true;
    }
    return false;
  }

  deleteJob(jobId: string): boolean {
    if (this.activeJobs.has(jobId)) {
      return false; // Cannot delete running job
    }
    return this.jobs.delete(jobId);
  }

  // Statistics
  getJobStats(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const duration = job.completedAt ? job.completedAt - job.startedAt! : Date.now() - (job.startedAt || job.createdAt);
    
    return {
      ...job.progress,
      duration,
      avgOperationTime: job.progress.processed > 0 ? duration / job.progress.processed : 0,
      successRate: job.progress.total > 0 ? (job.progress.successful / job.progress.total) * 100 : 0
    };
  }
}

// Simple semaphore for concurrency control
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waitQueue.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    }
  }
}

export default BatchProcessingService;