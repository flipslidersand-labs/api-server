import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

class TaskService {
  async getTasks(filters = {}) {
    let query = supabase
      .from('tasks')
      .select('*, task_statuses(id, name, code, is_terminal, color)', { count: 'exact' });

    if (filters.status_id) {
      query = query.eq('current_status_id', filters.status_id);
    }
    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }
    if (filters.q) {
      // Full-text-style search on title and description
      query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    }
    if (filters.due_before) {
      query = query.lte('due_date', filters.due_before);
    }
    if (filters.due_after) {
      query = query.gte('due_date', filters.due_after);
    }

    query = query.eq('is_deleted', false).order('created_at', { ascending: false });

    if (filters.limit && filters.offset !== undefined) {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return { tasks: data, total_count: count || 0 };
  }

  async getTask(taskId) {
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*, task_statuses(id, name, code, is_terminal, color)')
      .eq('id', taskId)
      .single();

    if (error) throw error;
    if (!task) return null;

    const { data: logs } = await supabase
      .from('task_events')
      .select('*')
      .eq('task_id', taskId)
      .order('occurred_at', { ascending: true });

    return {
      ...task,
      status_history: logs
    };
  }

  async createTask(title, description, assignedTo = null) {
    // Get the default status (first status by sort order)
    const { data: statuses } = await supabase
      .from('task_statuses')
      .select('id')
      .order('sort_order', { ascending: true })
      .limit(1);

    const defaultStatusId = statuses?.[0]?.id;
    if (!defaultStatusId) throw new Error('No default status found');

    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title,
        description,
        current_status_id: defaultStatusId,
        assigned_to: assignedTo,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTaskStatus(taskId, newStatusId, changedBy = null) {
    const { data: task } = await supabase
      .from('tasks')
      .select('current_status_id')
      .eq('id', taskId)
      .single();

    if (!task) throw new Error('Task not found');

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        current_status_id: newStatusId,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (updateError) throw updateError;

    const { error: logError } = await supabase
      .from('task_events')
      .insert([{
        task_id: taskId,
        from_status_id: task.current_status_id,
        to_status_id: newStatusId,
        changed_by: changedBy,
        occurred_at: new Date().toISOString()
      }]);

    if (logError) throw logError;

    return { success: true };
  }

  async updateTask(taskId, fields) {
    const allowed = ['title', 'description', 'assigned_to', 'due_date'];
    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        updates[key] = fields[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      throw Object.assign(new Error('No updatable fields provided'), { code: 'VALIDATION_ERROR', status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('is_deleted', false)
      .select('*, task_statuses(id, name, code, is_terminal, color)')
      .single();

    if (error) throw error;
    if (!data) throw Object.assign(new Error('Task not found'), { code: 'NOT_FOUND', status: 404 });
    return data;
  }

  async deleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_deleted: true })
      .eq('id', taskId);

    if (error) throw error;
    return { success: true };
  }
}

export default new TaskService();
