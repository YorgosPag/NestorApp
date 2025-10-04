'use client';

// DXF Viewer Collaboration Manager
export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  isActive: boolean;
  lastSeen: number;
}

export interface CollaborationEvent {
  id: string;
  type: 'cursor_move' | 'selection_change' | 'viewport_change' | 'annotation_add' | 'user_join' | 'user_leave';
  userId: string;
  timestamp: number;
  data: any;
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
}

export interface Annotation {
  id: string;
  userId: string;
  type: 'note' | 'measurement' | 'markup';
  position: { x: number; y: number };
  content: string;
  timestamp: number;
  resolved?: boolean;
}

class DXFCollaborationManager {
  private users = new Map<string, CollaborationUser>();
  private annotations: Annotation[] = [];
  private currentUser: CollaborationUser | null = null;
  private eventHandlers = new Map<string, Function[]>();
  
  // WebSocket integration will be injected
  private wsService: any = null;
  
  // Cursor tracking
  private cursorThrottle: NodeJS.Timeout | null = null;
  private lastCursorUpdate = 0;
  
  // Selection tracking
  private currentSelection: string[] = [];
  
  // Viewport sync
  private viewportState: ViewportState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0
  };

  constructor(wsService?: any) {
    this.wsService = wsService;
    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners() {
    if (!this.wsService) return;

    // Listen for collaboration events
    this.wsService.addEventListener('dxf_collaboration', (message: any) => {
      this.handleCollaborationEvent(message.payload);
    });

    // User presence events
    this.wsService.addEventListener('user_online', (message: any) => {
      this.handleUserJoin(message.payload);
    });

    this.wsService.addEventListener('user_offline', (message: any) => {
      this.handleUserLeave(message.payload);
    });
  }

  // User management
  setCurrentUser(user: Omit<CollaborationUser, 'isActive' | 'lastSeen'>) {
    this.currentUser = {
      ...user,
      isActive: true,
      lastSeen: Date.now()
    };

    this.users.set(user.id, this.currentUser);
    this.broadcastEvent('user_join', this.currentUser);
  }

  private handleUserJoin(userData: any) {
    const user: CollaborationUser = {
      id: userData.userId,
      name: userData.name || userData.userId,
      email: userData.userId,
      color: this.generateUserColor(userData.userId),
      isActive: true,
      lastSeen: Date.now()
    };

    this.users.set(user.id, user);
    this.emit('user_joined', user);
  }

  private handleUserLeave(userData: any) {
    const user = this.users.get(userData.userId);
    if (user) {
      user.isActive = false;
      this.emit('user_left', user);
      
      // Remove after delay
      setTimeout(() => {
        this.users.delete(userData.userId);
        this.emit('users_changed', Array.from(this.users.values()));
      }, 5000);
    }
  }

  getUsers(): CollaborationUser[] {
    return Array.from(this.users.values()).filter(u => u.isActive);
  }

  // Cursor tracking
  updateCursor(x: number, y: number) {
    if (!this.currentUser) return;

    // Throttle cursor updates to avoid spam
    const now = Date.now();
    if (now - this.lastCursorUpdate < 50) return; // Max 20 FPS
    
    this.currentUser.cursor = { x, y };
    this.lastCursorUpdate = now;
    
    if (this.cursorThrottle) {
      clearTimeout(this.cursorThrottle);
    }

    this.cursorThrottle = setTimeout(() => {
      this.broadcastEvent('cursor_move', { x, y });
    }, 50);
  }

  private handleCursorMove(userId: string, data: { x: number; y: number }) {
    const user = this.users.get(userId);
    if (user && user.id !== this.currentUser?.id) {
      user.cursor = data;
      this.emit('cursor_moved', { user, cursor: data });
    }
  }

  // Selection management
  updateSelection(entityIds: string[]) {
    this.currentSelection = [...entityIds];
    
    if (this.currentUser) {
      this.currentUser.selection = entityIds;
      this.broadcastEvent('selection_change', { entityIds });
    }
  }

  private handleSelectionChange(userId: string, data: { entityIds: string[] }) {
    const user = this.users.get(userId);
    if (user && user.id !== this.currentUser?.id) {
      user.selection = data.entityIds;
      this.emit('selection_changed', { user, selection: data.entityIds });
    }
  }

  getSelection(): string[] {
    return [...this.currentSelection];
  }

  // Viewport synchronization
  updateViewport(viewport: ViewportState) {
    this.viewportState = { ...viewport };
    this.broadcastEvent('viewport_change', viewport);
  }

  private handleViewportChange(userId: string, viewport: ViewportState) {
    if (userId !== this.currentUser?.id) {
      this.emit('viewport_changed', { userId, viewport });
    }
  }

  syncToViewport(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      this.emit('sync_viewport_requested', { user, viewport: this.viewportState });
    }
  }

  // Annotations
  addAnnotation(type: Annotation['type'], position: { x: number; y: number }, content: string): string {
    if (!this.currentUser) return '';

    const annotation: Annotation = {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: this.currentUser.id,
      type,
      position,
      content,
      timestamp: Date.now(),
      resolved: false
    };

    this.annotations.push(annotation);
    this.broadcastEvent('annotation_add', annotation);
    this.emit('annotation_added', annotation);
    
    return annotation.id;
  }

  private handleAnnotationAdd(annotation: Annotation) {
    if (annotation.userId !== this.currentUser?.id) {
      this.annotations.push(annotation);
      this.emit('annotation_added', annotation);
    }
  }

  resolveAnnotation(annotationId: string) {
    const annotation = this.annotations.find(a => a.id === annotationId);
    if (annotation) {
      annotation.resolved = true;
      this.broadcastEvent('annotation_resolve', { annotationId });
      this.emit('annotation_resolved', annotation);
    }
  }

  getAnnotations(): Annotation[] {
    return this.annotations.filter(a => !a.resolved);
  }

  // Event broadcasting
  private broadcastEvent(type: CollaborationEvent['type'], data: any) {
    if (!this.wsService || !this.currentUser) return;

    const event: CollaborationEvent = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      data
    };

    this.wsService.send('dxf_collaboration', event);
  }

  private handleCollaborationEvent(event: CollaborationEvent) {
    if (event.userId === this.currentUser?.id) return; // Ignore own events

    switch (event.type) {
      case 'cursor_move':
        this.handleCursorMove(event.userId, event.data);
        break;
      case 'selection_change':
        this.handleSelectionChange(event.userId, event.data);
        break;
      case 'viewport_change':
        this.handleViewportChange(event.userId, event.data);
        break;
      case 'annotation_add':
        this.handleAnnotationAdd(event.data);
        break;
    }
  }

  // Event system
  on(event: string, handler: Function): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in collaboration event handler:', error);
      }
    });
  }

  // Utility methods
  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  // Cleanup
  destroy() {
    if (this.cursorThrottle) {
      clearTimeout(this.cursorThrottle);
    }
    
    if (this.currentUser) {
      this.broadcastEvent('user_leave', { userId: this.currentUser.id });
    }
    
    this.eventHandlers.clear();
    this.users.clear();
    this.annotations = [];
  }
}

export default DXFCollaborationManager;