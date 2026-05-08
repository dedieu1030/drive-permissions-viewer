/**
 * Homepage Trigger
 * Runs when the user opens the add-on without selecting any file.
 */
function onHomepage(e) {
  return createHomepageCard();
}

/**
 * Contextual Trigger
 * Runs when a user selects items in Google Drive.
 */
function onDriveItemsSelected(e) {
  var items = e.drive.selectedItems;
  if (items.length !== 1) {
    return createMultipleItemsCard();
  }
  return buildPermissionCard(items[0].id);
}
