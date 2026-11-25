import { Module } from '@nestjs/common';

import { LocalStorageService } from '../users/local-storage.service';

@Module({
  providers: [LocalStorageService],
  exports: [LocalStorageService],
})
export class StorageModule {}
