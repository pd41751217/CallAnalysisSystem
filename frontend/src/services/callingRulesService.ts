import api from './api';

export interface CallingRule {
  id: string;
  title: string;
  description: string;
  dos: boolean; // true for "do", false for "don't"
  weight: number; // 0-100
  created_at: string;
  updated_at: string;
}

export interface CreateCallingRuleData {
  title: string;
  description: string;
  dos: boolean;
  weight: number;
}

export interface UpdateCallingRuleData {
  title?: string;
  description?: string;
  dos?: boolean;
  weight?: number;
}

export interface CallingRulesStats {
  total: number;
  do: number;
  dont: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: string[];
}

class CallingRulesService {
  private baseUrl = '/calling-rules';

  // Get all calling rules
  async getAllRules(): Promise<CallingRule[]> {
    try {
      const response = await api.get<ApiResponse<CallingRule[]>>(this.baseUrl);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Failed to fetch calling rules');
    } catch (error: any) {
      console.error('Error fetching calling rules:', error);
      throw error;
    }
  }

  // Get calling rules by type (do/don't)
  async getRulesByType(type: 'do' | 'dont'): Promise<CallingRule[]> {
    try {
      const response = await api.get<ApiResponse<CallingRule[]>>(`${this.baseUrl}/type/${type}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Failed to fetch calling rules by type');
    } catch (error: any) {
      console.error('Error fetching calling rules by type:', error);
      throw error;
    }
  }

  // Get a specific calling rule by ID
  async getRuleById(id: string): Promise<CallingRule> {
    try {
      const response = await api.get<ApiResponse<CallingRule>>(`${this.baseUrl}/${id}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Failed to fetch calling rule');
    } catch (error: any) {
      console.error('Error fetching calling rule by ID:', error);
      throw error;
    }
  }

  // Create a new calling rule
  async createRule(ruleData: CreateCallingRuleData): Promise<CallingRule> {
    try {
      const response = await api.post<ApiResponse<CallingRule>>(this.baseUrl, ruleData);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Failed to create calling rule');
    } catch (error: any) {
      console.error('Error creating calling rule:', error);
      throw error;
    }
  }

  // Update a calling rule
  async updateRule(id: string, updates: UpdateCallingRuleData): Promise<CallingRule> {
    try {
      const response = await api.put<ApiResponse<CallingRule>>(`${this.baseUrl}/${id}`, updates);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Failed to update calling rule');
    } catch (error: any) {
      console.error('Error updating calling rule:', error);
      throw error;
    }
  }

  // Delete a calling rule
  async deleteRule(id: string): Promise<void> {
    try {
      const response = await api.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete calling rule');
      }
    } catch (error: any) {
      console.error('Error deleting calling rule:', error);
      throw error;
    }
  }

  // Get calling rules statistics
  async getStats(): Promise<CallingRulesStats> {
    try {
      const response = await api.get<ApiResponse<CallingRulesStats>>(`${this.baseUrl}/stats`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Failed to fetch calling rules statistics');
    } catch (error: any) {
      console.error('Error fetching calling rules statistics:', error);
      throw error;
    }
  }

  // Validate rule data
  validateRuleData(data: CreateCallingRuleData | UpdateCallingRuleData): string[] {
    const errors: string[] = [];

    if ('title' in data && (!data.title || data.title.trim().length === 0)) {
      errors.push('Title is required');
    }

    if ('description' in data && (!data.description || data.description.trim().length === 0)) {
      errors.push('Description is required');
    }

    if ('dos' in data && typeof data.dos !== 'boolean') {
      errors.push('Dos field must be a boolean');
    }

    if ('weight' in data && (typeof data.weight !== 'number' || data.weight < 0 || data.weight > 100)) {
      errors.push('Weight must be a number between 0 and 100');
    }

    return errors;
  }

  // Format rule type for display
  formatRuleType(isDos: boolean): string {
    return isDos ? 'Do' : "Don't";
  }

  // Get rule type color for UI
  getRuleTypeColor(isDos: boolean): 'success' | 'error' {
    return isDos ? 'success' : 'error';
  }

  // Get weight color based on value
  getWeightColor(weight: number): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
    if (weight >= 80) return 'success';
    if (weight >= 60) return 'info';
    if (weight >= 40) return 'warning';
    return 'error';
  }
}

export const callingRulesService = new CallingRulesService();
