# cliDescription

uninstall a second-generation package from the target org

Specify the package ID for a second-generation package.

To list the org’s installed packages, run "sfdx force:package:beta:installed:list".

To uninstall a first-generation package, from Setup, enter Installed Packages in the Quick Find box, then select Installed Packages.

# examples

$ sfdx force:package:beta:uninstall -p 04t... -u me@example.com
$ sfdx force:package:beta:uninstall -p undesirable_package_alias
$ sfdx force:package:beta:uninstall -p "Undesirable Package Alias"

# id

ID of the package to uninstall (starts with 04t)

# idLong

The ID of the second-generation package to uninstall (starts with 04t).

# wait

number of minutes to wait for uninstall status

# waitLong

Maximum number of minutes to wait for uninstall status. The default is 0.

# defaultErrorMessage

Can't uninstall the package %s during uninstall request %s.

# humanSuccess

Successfully uninstalled package ID %s.

# action

Verify installed package ID and resolve errors, then try again.

# package

ID (starts with 04t) or alias of the package version to uninstall

# packageLong

The ID (starts with 04t) or alias of the package version to uninstall.

# errorRequiredFlags

Include either a %s value or a %s value.

# InProgress

PackageUninstallRequest is currently InProgress.
You can continue to query the status using sfdx force:package:beta:uninstall:report -i %s -u %s

# Success

Successfully uninstalled package [%s]

# errorInvalidPackageId

Invalid alias or ID: %s. Either your alias is invalid or undefined, or the ID provided is invalid.
