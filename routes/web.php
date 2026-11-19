<?php

use App\Http\Controllers\ArchiveController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\DocumentCategoryController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PasswordChangeController;
use App\Http\Controllers\PositionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

Route::middleware(['auth', 'password.current'])->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    Route::get('/password/force', [PasswordChangeController::class, 'edit'])->name('password.force.edit');
    Route::put('/password/force', [PasswordChangeController::class, 'update'])->name('password.force.update');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/signature', [ProfileController::class, 'updateSignature'])->name('profile.signature.update');
    Route::delete('/profile/signature', [ProfileController::class, 'destroySignature'])->name('profile.signature.destroy');
    Route::put('/profile/stamp', [ProfileController::class, 'updateStamp'])->name('profile.stamp.update');
    Route::delete('/profile/stamp', [ProfileController::class, 'destroyStamp'])->name('profile.stamp.destroy');

    Route::get('/team', [UserController::class, 'team'])->name('team.index');
    Route::get('/users', [UserController::class, 'index'])->name('users.index');
    Route::post('/users', [UserController::class, 'store'])->name('users.store');
    Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');
    Route::get('/activity-logs', [UserController::class, 'activityLogs'])->name('activity-logs.index');

    Route::get('/roles', [RoleController::class, 'index'])->name('roles.index');
    Route::post('/roles', [RoleController::class, 'store'])->name('roles.store');
    Route::put('/roles/{role}', [RoleController::class, 'update'])->name('roles.update');
    Route::delete('/roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');

    Route::get('/settings', [SettingsController::class, 'edit'])->name('settings.edit');
    Route::put('/settings', [SettingsController::class, 'update'])->name('settings.update');

    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('/reports/me', [ReportController::class, 'me'])->name('reports.me');
    Route::get('/reports/departments/{department}', [ReportController::class, 'department'])->name('reports.department');

    Route::get('/departments', [DepartmentController::class, 'index'])->name('departments.index');
    Route::post('/departments', [DepartmentController::class, 'store'])->name('departments.store');
    Route::get('/departments/{department}', [DepartmentController::class, 'show'])->name('departments.show');
    Route::get('/departments/{department}/edit', [DepartmentController::class, 'edit'])->name('departments.edit');
    Route::put('/departments/{department}', [DepartmentController::class, 'update'])->name('departments.update');
    Route::delete('/departments/{department}', [DepartmentController::class, 'destroy'])->name('departments.destroy');
    Route::post('/departments/{department}/positions', [PositionController::class, 'store'])->name('positions.store');
    Route::put('/positions/{position}', [PositionController::class, 'update'])->name('positions.update');
    Route::delete('/positions/{position}', [PositionController::class, 'destroy'])->name('positions.destroy');

    Route::resource('documents', DocumentController::class);
    Route::get('/documents/{document}/file', [DocumentController::class, 'file'])->name('documents.file');
    Route::get('/documents/{document}/download', [DocumentController::class, 'download'])->name('documents.download');
    Route::post('/documents/{document}/approve', [DocumentController::class, 'approve'])->name('documents.approve');
    Route::post('/documents/{document}/reject', [DocumentController::class, 'reject'])->name('documents.reject');
    Route::post('/documents/{document}/annotations', [DocumentController::class, 'storeAnnotation'])->name('documents.annotations.store');
    Route::put('/annotations/{annotation}', [DocumentController::class, 'updateAnnotation'])->name('annotations.update');
    Route::post('/annotations/{annotation}/resolve', [DocumentController::class, 'resolveAnnotation'])->name('annotations.resolve');
    Route::delete('/annotations/{annotation}', [DocumentController::class, 'destroyAnnotation'])->name('annotations.destroy');
    Route::post('/documents/{document}/sign', [DocumentController::class, 'sign'])->name('documents.sign');
    Route::post('/documents/{document}/stamp', [DocumentController::class, 'stamp'])->name('documents.stamp');
    Route::delete('/signatures/{signature}', [DocumentController::class, 'destroySignature'])->name('signatures.destroy');
    Route::post('/documents/{document}/flatten', [DocumentController::class, 'flatten'])->name('documents.flatten');
    Route::post('/documents/{document}/pages', [DocumentController::class, 'updatePages'])->name('documents.pages');
    Route::post('/documents/{document}/move', [DocumentController::class, 'move'])->name('documents.move');

    Route::get('/categories', [DocumentCategoryController::class, 'index'])->name('categories.index');
    Route::post('/categories', [DocumentCategoryController::class, 'store'])->name('categories.store');
    Route::put('/categories/{category}', [DocumentCategoryController::class, 'update'])->name('categories.update');
    Route::delete('/categories/{category}', [DocumentCategoryController::class, 'destroy'])->name('categories.destroy');

    Route::get('/archive', [ArchiveController::class, 'index'])->name('archive.index');
    Route::post('/archive', [ArchiveController::class, 'store'])->name('archive.store');
    Route::post('/archive/{archive}/unarchive', [ArchiveController::class, 'unarchive'])->name('archive.unarchive');
    Route::get('/search', [ArchiveController::class, 'search'])->name('archive.search');

    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('notifications.read');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.read-all');
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
    Route::post('/push/subscribe', [NotificationController::class, 'subscribe'])->name('push.subscribe');
    Route::post('/push/unsubscribe', [NotificationController::class, 'unsubscribe'])->name('push.unsubscribe');
    Route::get('/push/vapid-public-key', [NotificationController::class, 'vapidPublicKey'])->name('push.vapid');
});

require __DIR__.'/auth.php';
