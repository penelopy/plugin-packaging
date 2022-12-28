/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';
import { resolve } from 'path';
import { Connection, Lifecycle, SfProject, SfError, SfProjectJson } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { stubMethod } from '@salesforce/ts-sinon';
import { Config } from '@oclif/core';
import { expect } from 'chai';
import { PackageEvents, PackagingSObjects, SubscriberPackageVersion } from '@salesforce/packaging';
import * as sinon from 'sinon';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Install } from '../../../../src/commands/force/package/beta/install';
import InstallValidationStatus = PackagingSObjects.InstallValidationStatus;

const myPackageVersion04t = '04t6A000002zgKSQAY';

const pkgInstallRequest = {
  attributes: {
    type: 'PackageInstallRequest',
    url: '/services/data/v55.0/tooling/sobjects/PackageInstallRequest/0Hf1h0000006sh2CAA',
  },
  Id: '0Hf1h0000006sh2CAA',
  IsDeleted: false,
  CreatedDate: '2022-08-09T05:13:14.000+0000',
  CreatedById: '0051h000009NugzAAC',
  LastModifiedDate: '2022-08-09T05:13:14.000+0000',
  LastModifiedById: '0051h000009NugzAAC',
  SystemModstamp: '2022-08-09T05:13:14.000+0000',
  SubscriberPackageVersionKey: myPackageVersion04t,
  NameConflictResolution: 'Block',
  SecurityType: 'None',
  PackageInstallSource: 'U',
  ProfileMappings: null,
  Password: null,
  EnableRss: false,
  UpgradeType: 'mixed-mode',
  ApexCompileType: 'all',
  Status: 'IN_PROGRESS',
  Errors: null,
};

const pkgInstallCreateRequest = {
  SubscriberPackageVersionKey: myPackageVersion04t,
  Password: undefined,
  ApexCompileType: 'all',
  SecurityType: 'none',
  UpgradeType: 'mixed-mode',
};

const subscriberPackageVersion: PackagingSObjects.SubscriberPackageVersion = {
  AppExchangeDescription: '',
  AppExchangeLogoUrl: '',
  AppExchangePackageName: '',
  AppExchangePublisherName: '',
  BuildNumber: 0,
  // @ts-ignore
  CspTrustedSites: undefined,
  // @ts-ignore
  Dependencies: undefined,
  Description: '',
  Id: myPackageVersion04t,
  InstallValidationStatus: 'NO_ERRORS_DETECTED',
  IsBeta: false,
  IsDeprecated: false,
  IsManaged: false,
  IsOrgDependent: false,
  IsPasswordProtected: false,
  IsSecurityReviewed: false,
  MajorVersion: 0,
  MinorVersion: 0,
  Name: '',
  // @ts-ignore
  Package2ContainerOptions: undefined,
  PatchVersion: 0,
  PostInstallUrl: '',
  // @ts-ignore
  Profiles: undefined,
  PublisherName: '',
  ReleaseNotesUrl: '',
  ReleaseState: '',
  // @ts-ignore
  RemoteSiteSettings: undefined,
  SubscriberPackageId: '',
};

describe('force:package:install', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  const config = new Config({ root: resolve(__dirname, '../../package.json') });
  let uxLogStub: sinon.SinonStub;
  let uxConfirmStub: sinon.SinonStub;
  let packageVersionStub: sinon.SinonStub;
  let getExternalSitesStub: sinon.SinonStub;
  let installStub: sinon.SinonStub;
  let installStatusStub: sinon.SinonStub;
  const sandbox = sinon.createSandbox();

  before(async () => {
    await $$.stubAuths(testOrg);
    await config.load();
  });

  beforeEach(async () => {
    uxLogStub = sandbox.stub(SfCommand.prototype, 'log');
  });

  afterEach(() => {
    $$.restore();
    sandbox.restore();
  });

  describe('force:package:install', () => {
    beforeEach(() => {
      getExternalSitesStub = $$.SANDBOX.stub();
      installStub = $$.SANDBOX.stub();
      installStatusStub = $$.SANDBOX.stub();
      uxConfirmStub = stubMethod($$.SANDBOX, SfCommand.prototype, 'confirm');

      // The SubscriberPackageVersion class is tested in the packaging library, so
      // we just stub the public APIs used by the command.
      packageVersionStub = $$.SANDBOX.stub().callsFake(() => ({
        install: installStub,
        getInstallStatus: installStatusStub,
      }));
      Object.setPrototypeOf(SubscriberPackageVersion, packageVersionStub);
    });

    it('should error without required --package param', async () => {
      try {
        await new Install(['-o', testOrg.username], config).run();
        expect(false, 'Expected required flag error').to.be.true;
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('Error');
        expect(error.message).to.include('Missing required flag package');
      }
    });

    it('should error with org API Version < 36.0', async () => {
      try {
        await new Install(['-p', myPackageVersion04t, '-o', testOrg.username, '--apiversion', '33.0'], config).run();
        expect(false, 'Expected API version too low error').to.be.true;
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('ApiVersionTooLowError');
        expect(error.message).to.include('This command is supported only on API versions 36.0 and higher');
      }
    });

    it('should print IN_PROGRESS status correctly', async () => {
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);

      const result = await new Install(['-p', myPackageVersion04t, '-o', testOrg.username], config).run();

      expect(uxLogStub.calledOnce).to.be.true;
      const msg = `PackageInstallRequest is currently InProgress. You can continue to query the status using${EOL}sfdx force:package:beta:install:report -i 0Hf1h0000006sh2CAA -u ${testOrg.username}`;
      expect(uxLogStub.args[0][0]).to.deep.equal(msg);
      expect(result).to.deep.equal(pkgInstallRequest);
      expect(installStub.args[0][0]).to.deep.equal(pkgInstallCreateRequest);
    });

    it('should print IN_PROGRESS status when timed out', async () => {
      const error = new SfError('polling timed out', 'PackageInstallTimeout');
      error.setData(pkgInstallRequest);
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').throws(error);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);
      const result = await new Install(['-p', myPackageVersion04t, '-u', testOrg.username], config).run();
      expect(uxLogStub.callCount).to.equal(2);
      const msg = `PackageInstallRequest is currently InProgress. You can continue to query the status using${EOL}sfdx force:package:beta:install:report -i 0Hf1h0000006sh2CAA -u ${testOrg.username}`;
      expect(uxLogStub.args[1][0]).to.equal(msg);
      expect(uxLogStub.args[0][0]).to.include('The "-u" flag has been deprecated. Use "--target-org" instead.');
      expect(result).to.deep.equal(pkgInstallRequest);
      expect(installStub.args[0][0]).to.deep.equal(pkgInstallCreateRequest);
      // expect(uxStopSpinnerStub.args[0][0]).to.equal('Polling timeout exceeded');
    });

    it('should return PackageInstallRequest when polling timed out with --json', async () => {
      const error = new SfError('polling timed out', 'PackageInstallTimeout');
      error.setData(pkgInstallRequest);
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').throws(error);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);
      const result = await new Install(['-p', myPackageVersion04t, '--json', '-u', testOrg.username], config).run();
      expect(result).to.deep.equal(pkgInstallRequest);
      expect(installStub.args[0][0]).to.deep.equal(pkgInstallCreateRequest);
    });

    it('should print SUCCESS status correctly', async () => {
      const request = Object.assign({}, pkgInstallRequest, { Status: 'SUCCESS' });
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(request);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);

      const result = await new Install(['-p', myPackageVersion04t, '-o', testOrg.username], config).run();

      expect(uxLogStub.calledOnce).to.be.true;
      const msg = 'Successfully installed package [04t6A000002zgKSQAY]';
      expect(uxLogStub.args[0][0]).to.equal(msg);
      expect(result).to.deep.equal(request);
      expect(installStub.args[0][0]).to.deep.equal(pkgInstallCreateRequest);
    });

    it('should throw error for ERROR status and no install errors', async () => {
      const request = Object.assign({}, pkgInstallRequest, { Status: 'ERROR' });
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(request);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);
      try {
        await new Install(['-p', myPackageVersion04t, '-o', testOrg.username], config).run();
        expect.fail('Expected error to be thrown');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('PackageInstallError');
        expect(error.message).to.equal('Encountered errors installing the package! <empty>');
      }
    });

    it('should throw error for ERROR status with install errors', async () => {
      const request = Object.assign({}, pkgInstallRequest, {
        Status: 'ERROR',
        Errors: { errors: [new Error('message 1'), new Error('message 2')] },
      });
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(request);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);
      try {
        await new Install(['-p', myPackageVersion04t, '-o', testOrg.username], config).run();
        expect.fail('Expected error to be thrown');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('PackageInstallError');
        expect(error.message).to.equal(
          'Encountered errors installing the package! Installation errors: \n1) message 1\n2) message 2'
        );
      }
    });

    it('should throw PackageAliasNotFoundError', async () => {
      try {
        await new Install(['-p', 'my_package_alias', '-o', testOrg.username], config).run();
        expect.fail('Expected InvalidAliasOrIdError to be thrown');
      } catch (err) {
        const error = err as Error;
        expect(error.name).to.equal('ErrorInvalidAliasOrIdError');
        expect(error.message).to.equal(
          'Invalid alias or ID: my_package_alias. Either your alias is invalid or undefined, or the ID (04t) provided is invalid.'
        );
      }
    });

    // TODO: It seems that while linking @salesforce/packaging into the plugin
    // we cannot stub the library calls of `SfProject.getInstance` e.g. "SfProject, 'getInstance'"
    // once the library has been published, the stubs resume to work and this test will pass
    it('should print SUCCESS status correctly for package alias', async () => {
      // Stubs SfProject.getInstance, SfProject.getSfProjectJson, and SfProjectJson.getContents
      // in a way that makes TS happy... all to test package aliases.
      const getContentsStub = stubMethod($$.SANDBOX, SfProjectJson.prototype, 'getContents').returns({
        packageAliases: { ['my_package_alias']: myPackageVersion04t },
      });
      const getSfProjectJsonStub = stubMethod($$.SANDBOX, SfProject.prototype, 'getSfProjectJson').callsFake(() => ({
        getContents: getContentsStub,
      }));
      const getPackageIdFromAliasStub = stubMethod($$.SANDBOX, SfProject.prototype, 'getPackageIdFromAlias').returns(
        myPackageVersion04t
      );
      stubMethod($$.SANDBOX, SfProject, 'getInstance').callsFake(() => ({
        getSfProjectJson: getSfProjectJsonStub,
        getPackageIdFromAlias: getPackageIdFromAliasStub,
      }));

      const request = Object.assign({}, pkgInstallRequest, { Status: 'SUCCESS' });
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(request);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);
      const result = await new Install(['-p', 'my_package_alias', '-o', testOrg.username], config).run();

      expect(uxLogStub.calledOnce).to.be.true;
      const msg = 'Successfully installed package [my_package_alias]';
      expect(uxLogStub.args[0][0]).to.equal(msg);
      expect(result).to.deep.equal(request);
      expect(installStub.args[0][0]).to.deep.equal(pkgInstallCreateRequest);
    });

    it('should use installation key as password', async () => {
      const installationkey = '1234abcd';
      const expectedCreateRequest = Object.assign({}, pkgInstallCreateRequest, { Password: installationkey });
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);
      const result = await new Install(
        ['-p', myPackageVersion04t, '-k', installationkey, '-o', testOrg.username],
        config
      ).run();
      expect(result).to.deep.equal(pkgInstallRequest);
      expect(installStub.args[0][0]).to.deep.equal(expectedCreateRequest);
    });

    it('sets PackageInstallRequest values for securityType, upgradeType, apexCompileType', async () => {
      const overrides = {
        ApexCompileType: 'package',
        SecurityType: 'full',
        UpgradeType: 'deprecate-only',
      };
      const expectedCreateRequest = Object.assign({}, pkgInstallCreateRequest, overrides);
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);

      const result = await new Install(
        [
          '-p',
          myPackageVersion04t,
          '-a',
          overrides.ApexCompileType,
          '-s',
          'AllUsers',
          '-t',
          'DeprecateOnly',
          '-u',
          testOrg.username,
        ],
        config
      ).run();

      expect(result).to.deep.equal(pkgInstallRequest);
      expect(installStub.args[0][0]).to.deep.equal(expectedCreateRequest);
    });

    it('should listen for PackageInstallRequest:warning events and log warnings', async () => {
      const warningMsg = 'test warning message';
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').callsFake(async () => {
        await Lifecycle.getInstance().emit(PackageEvents.install.warning, warningMsg);
        return pkgInstallRequest;
      });
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);

      const result = await new Install(['-p', myPackageVersion04t, '-o', testOrg.username], config).run();

      expect(uxLogStub.callCount).to.equal(11);
      expect(uxLogStub.args[0][0]).to.equal(warningMsg);
      const msg = `PackageInstallRequest is currently InProgress. You can continue to query the status using${EOL}sfdx force:package:beta:install:report -i 0Hf1h0000006sh2CAA -u ${testOrg.username}`;
      expect(uxLogStub.args[10][0]).to.equal(msg);
      expect(result).to.deep.equal(pkgInstallRequest);
    });

    it('should listen for Package/install-status polling events and log statuses', async () => {
      const successRequest = Object.assign({}, pkgInstallRequest, { Status: 'SUCCESS' });
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').callsFake(async () => {
        await Lifecycle.getInstance().emit(PackageEvents.install.status, pkgInstallRequest);
        await Lifecycle.getInstance().emit(PackageEvents.install.status, successRequest);
        return pkgInstallRequest;
      });
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);

      const result = await new Install(['-p', myPackageVersion04t, '-w', '1', '-o', testOrg.username], config).run();

      expect(uxLogStub.calledOnce).to.be.true;
      // expect(uxSetSpinnerStatusStub.args[0][0]).to.equal(
      //   '1 minutes remaining until timeout. Install status: IN_PROGRESS'
      // );
      // expect(uxSetSpinnerStatusStub.args[1][0]).to.equal('1 minutes remaining until timeout. Install status: SUCCESS');
      expect(result).to.deep.equal(pkgInstallRequest);
    });

    it('should listen for Package/install-status and Package/install/subscriber-status polling events and log statuses', async () => {
      const successRequest = Object.assign({}, pkgInstallRequest, { Status: 'SUCCESS' });
      installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').callsFake(async () => {
        await Lifecycle.getInstance().emit(
          PackageEvents.install['subscriber-status'],
          'PACKAGE_UNAVAILABLE' as InstallValidationStatus
        );
        await Lifecycle.getInstance().emit(
          PackageEvents.install['subscriber-status'],
          'NO_ERRORS_DETECTED' as InstallValidationStatus
        );
        await Lifecycle.getInstance().emit(PackageEvents.install.status, pkgInstallRequest);
        await Lifecycle.getInstance().emit(PackageEvents.install.status, successRequest);
        return pkgInstallRequest;
      });
      stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves(subscriberPackageVersion);

      const command = new Install(['-p', myPackageVersion04t, '-w', '1', '-b', '1', '-o', testOrg.username], config);
      const result = await command.run();

      expect(uxLogStub.calledOnce).to.be.true;
      // expect(uxSetSpinnerStatusStub.callCount).to.equal(4);
      // expect(uxSetSpinnerStatusStub.args[0][0]).to.equal(
      //   '1 minutes remaining until timeout. Publish status: Unavailable for installation'
      // );
      // expect(uxSetSpinnerStatusStub.args[1][0]).to.equal(
      //   '1 minutes remaining until timeout. Publish status: Available for installation'
      // );
      // expect(uxSetSpinnerStatusStub.args[2][0]).to.equal(
      //   '1 minutes remaining until timeout. Install status: IN_PROGRESS'
      // );
      // expect(uxSetSpinnerStatusStub.args[3][0]).to.equal('1 minutes remaining until timeout. Install status: SUCCESS');
      expect(result).to.deep.equal(pkgInstallRequest);
    });

    describe('confirm upgrade type', () => {
      it('should NOT confirm UpgradeType with --noprompt flag', async () => {
        installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
        stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves({
          ...subscriberPackageVersion,
          Package2ContainerOptions: 'Unlocked',
        });

        const result = await new Install(
          ['-p', myPackageVersion04t, '-t', 'Delete', '--noprompt', '-o', testOrg.username],
          config
        ).run();

        expect(uxConfirmStub.calledOnce).to.be.false;
        expect(result).to.deep.equal(pkgInstallRequest);
      });

      it('should confirm UpgradeType when NO --noprompt flag', async () => {
        installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
        stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves({
          ...subscriberPackageVersion,
          Package2ContainerOptions: 'Unlocked',
        });
        uxConfirmStub.resolves(true);

        const result = await new Install(
          ['-p', myPackageVersion04t, '-t', 'Delete', '-o', testOrg.username],
          config
        ).run();

        expect(uxConfirmStub.calledOnce).to.be.true;
        expect(result).to.deep.equal(pkgInstallRequest);
      });

      it('should confirm UpgradeType and throw with no consent', async () => {
        installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
        stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves({
          ...subscriberPackageVersion,
          Package2ContainerOptions: 'Unlocked',
        });

        try {
          await new Install(['-p', myPackageVersion04t, '-t', 'Delete', '-o', testOrg.username], config).run();
          expect(false, 'Expected PromptUpgradeTypeDenyError').to.be.true;
        } catch (err) {
          const error = err as Error;
          expect(error.name).to.equal('PromptUpgradeTypeDenyError');
          expect(error.message).to.include('We canceled this package installation per your request.');
          expect(uxConfirmStub.calledOnce).to.be.true;
        }
      });

      it('should NOT confirm UpgradeType with non-Unlocked packages', async () => {
        installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
        stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves({
          ...subscriberPackageVersion,
          Package2ContainerOptions: 'Managed',
        });

        const result = await new Install(
          ['-p', myPackageVersion04t, '-t', 'Delete', '--noprompt', '-o', testOrg.username],
          config
        ).run();

        expect(uxConfirmStub.calledOnce).to.be.false;
        expect(result).to.deep.equal(pkgInstallRequest);
      });
    });

    describe('confirm external sites', () => {
      const extSites = ['url/for/site1', 'url/for/site2'];

      it('should NOT confirm external sites with --noprompt flag', async () => {
        const expectedCreateRequest = Object.assign({}, pkgInstallCreateRequest, { EnableRss: true });
        getExternalSitesStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'getExternalSites').resolves(
          extSites
        );
        installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);

        const result = await new Install(
          ['-p', myPackageVersion04t, '--noprompt', '-o', testOrg.username],
          config
        ).run();

        expect(getExternalSitesStub.calledOnce).to.be.true;
        expect(uxConfirmStub.calledOnce).to.be.false;
        expect(installStub.args[0][0]).to.deep.equal(expectedCreateRequest);
        expect(result).to.deep.equal(pkgInstallRequest);
      });

      it('should NOT confirm external sites with --noprompt flag and installation key', async () => {
        const installationkey = '1234abcd';
        const expectedCreateRequest = Object.assign({}, pkgInstallCreateRequest, {
          EnableRss: true,
          Password: installationkey,
        });
        installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
        stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves({
          ...subscriberPackageVersion,
          RemoteSiteSettings: { settings: ['url/for/site1'] },
          CspTrustedSites: { settings: ['url/for/site2'] },
        });

        const result = await new Install(
          ['-p', myPackageVersion04t, '--noprompt', '-k', installationkey, '-u', testOrg.username],
          config
        ).run();

        expect(uxConfirmStub.calledOnce).to.be.false;
        expect(installStub.args[0][0]).to.deep.equal(expectedCreateRequest);
        expect(result).to.deep.equal(pkgInstallRequest);
      });

      it('should confirm external sites when NO --noprompt flag (yes answer)', async () => {
        const expectedCreateRequest = Object.assign({}, pkgInstallCreateRequest, { EnableRss: true });
        installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
        stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves({
          ...subscriberPackageVersion,
          RemoteSiteSettings: { settings: [{ url: 'url/for/site1' }] },
          CspTrustedSites: { settings: [{ endpointUrl: 'url/for/site2' }] },
        });
        uxConfirmStub.resolves(true);

        const result = await new Install(['-p', myPackageVersion04t, '-o', testOrg.username], config).run();

        expect(uxConfirmStub.calledOnce).to.be.true;
        expect(uxConfirmStub.args[0][0]).to.include(extSites.join('\n'));
        expect(installStub.args[0][0]).to.deep.equal(expectedCreateRequest);
        expect(result).to.deep.equal(pkgInstallRequest);
      });

      it('should confirm external sites when NO --noprompt flag (no answer)', async () => {
        installStub = stubMethod($$.SANDBOX, SubscriberPackageVersion.prototype, 'install').resolves(pkgInstallRequest);
        stubMethod($$.SANDBOX, Connection.prototype, 'singleRecordQuery').resolves({
          ...subscriberPackageVersion,
          RemoteSiteSettings: { settings: [{ url: 'url/for/site1' }] },
          CspTrustedSites: { settings: [{ endpointUrl: 'url/for/site2' }] },
        });

        const result = await new Install(['-p', myPackageVersion04t, '-o', testOrg.username], config).run();

        expect(uxConfirmStub.calledOnce).to.be.true;
        expect(uxConfirmStub.args[0][0]).to.include(extSites.join('\n'));
        expect(installStub.args[0][0]).to.deep.equal(pkgInstallCreateRequest);
        expect(result).to.deep.equal(pkgInstallRequest);
      });
    });
  });
});
