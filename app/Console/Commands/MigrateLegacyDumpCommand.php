<?php

namespace App\Console\Commands;

use App\Services\LegacyDumpImporter;
use Illuminate\Console\Command;

class MigrateLegacyDumpCommand extends Command
{
    protected $signature = 'board:migrate-legacy-dump
                            {path=database/dumps/e_db_backup.sql : Path to the PostgreSQL dump}
                            {--fresh : Wipe existing board data before importing (default)}
                            {--keep : Keep existing rows and attempt inserts (may fail on conflicts)}';

    protected $description = 'Import legacy Django PostgreSQL dump data into the Laravel board schema';

    public function handle(LegacyDumpImporter $importer): int
    {
        $path = $this->argument('path');
        $absolute = str_starts_with((string) $path, '/')
            ? (string) $path
            : base_path((string) $path);

        if (! is_readable($absolute)) {
            $this->error("Dump file not found or unreadable: {$absolute}");

            return self::FAILURE;
        }

        $fresh = ! $this->option('keep');

        $this->info(($fresh ? 'Replacing' : 'Merging').' board data from '.$absolute);

        $counts = $importer->import($absolute, $fresh);

        $this->table(['Table', 'Rows'], collect($counts)->map(
            fn (int $count, string $table): array => [$table, $count]
        )->values()->all());

        $this->info('Legacy dump import complete.');
        $this->comment('Document file paths were preserved; copy media into storage/app/public if PDFs are missing.');
        $this->comment('Existing Django password hashes remain valid and will upgrade to bcrypt on next password login.');

        return self::SUCCESS;
    }
}
