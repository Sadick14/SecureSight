import { supabase } from './supabase';
import { Project, ProjectScan, ProjectFile } from '../types';

export const createProject = async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getProjects = async (userId: string) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const deleteProject = async (projectId: string) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
};

export const runProjectScan = async (projectId: string) => {
  // Implementation depends on your scanning service
  // This is a placeholder for the actual implementation
  const { data, error } = await supabase
    .from('project_scans')
    .insert({
      project_id: projectId,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getProjectFiles = async (projectId: string) => {
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('path');

  if (error) throw error;
  return data;
};