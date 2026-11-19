<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Support\DocumentReportBuilder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(Request $request, DocumentReportBuilder $builder): Response
    {
        $user = $request->user();

        $departments = Department::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'code'])
            ->filter(fn (Department $department) => $department->userCanViewReports($user))
            ->values()
            ->map(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
                'code' => $department->code,
            ]);

        return Inertia::render('Reports/Index', [
            'me' => $builder->forUser($user),
            'departments' => $departments,
            'canViewAllDepartmentReports' => $user->isAdmin()
                || $user->canPerm('documents.view_all')
                || $user->canPerm('departments.manage')
                || $user->canPerm('reports.view'),
        ]);
    }

    public function me(Request $request, DocumentReportBuilder $builder): Response
    {
        return Inertia::render('Reports/Me', [
            'report' => $builder->forUser($request->user()),
            'user' => [
                'id' => $request->user()->id,
                'name' => $request->user()->name,
            ],
        ]);
    }

    public function department(Request $request, Department $department, DocumentReportBuilder $builder): Response
    {
        abort_unless($department->userCanViewReports($request->user()), 403);

        return Inertia::render('Reports/Department', [
            'department' => [
                'id' => $department->id,
                'name' => $department->name,
                'code' => $department->code,
            ],
            'report' => $builder->forDepartment($department),
        ]);
    }
}
