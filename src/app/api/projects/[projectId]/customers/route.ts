import { NextRequest, NextResponse } from 'next/server';
import { getProjectCustomers } from '@/services/projects.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = parseInt(params.projectId);
    
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const customers = await getProjectCustomers(projectId);
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching project customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project customers' },
      { status: 500 }
    );
  }
}