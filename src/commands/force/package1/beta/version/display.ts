/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { Package1Display, Package1Version } from '@salesforce/packaging';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-packaging', 'package1_version_display');

export class Package1VersionDisplayCommand extends SfdxCommand {
  public static readonly description = messages.getMessage('description');
  public static readonly requiresUsername = true;
  public static readonly flagsConfig: FlagsConfig = {
    packageversionid: flags.id({
      char: 'i',
      description: messages.getMessage('packageId'),
      longDescription: messages.getMessage('packageIdLong'),
      required: true,
      validate: (id) => {
        if (/^04t.{12,15}$/.test(id)) {
          return true;
        }
        throw messages.createError('packageIdInvalid');
      },
    }),
  };

  public async run(): Promise<Package1Display[]> {
    const pv1 = new Package1Version(this.org.getConnection(), this.flags.packageversionid as string);
    const results = (await pv1.getPackageVersion()).map((result) => ({
      MetadataPackageVersionId: result.Id,
      MetadataPackageId: result.MetadataPackageId,
      Name: result.Name,
      ReleaseState: result.ReleaseState,
      Version: `${result.MajorVersion}.${result.MinorVersion}.${result.PatchVersion}`,
      BuildNumber: result.BuildNumber,
    }));

    if (results.length === 0) {
      this.ux.log('No results found');
    } else {
      this.ux.table(results, {
        MetadataPackageVersionId: { header: 'MetadataPackageVersionId' },
        MetadataPackageId: { header: 'MetadataPackageId' },
        Name: { header: 'Name' },
        Version: { header: 'Version' },
        ReleaseState: { header: 'ReleaseState' },
        BuildNumber: { header: 'BuildNumber' },
      });
    }

    return results;
  }
}
