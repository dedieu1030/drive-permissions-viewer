/**
 * Helper to fetch file details and permissions using Drive API
 */
function getDriveItemDetails(fileId) {
  try {
    var file = Drive.Files.get(fileId, {
      fields: "id, name, mimeType, owners, shared, permissions, parents",
      supportsAllDrives: true
    });
    
    var currentUserEmail = Session.getActiveUser().getEmail();
    var currentDomain = currentUserEmail.split('@')[1] || "";
    
    var result = {
      name: file.name,
      id: file.id,
      isFolder: file.mimeType === "application/vnd.google-apps.folder",
      owner: file.owners && file.owners.length > 0 ? file.owners[0].emailAddress : "Unknown",
      isPublic: false,
      hasExternal: false,
      directPermissions: [],
      inheritedPermissions: []
    };
    
    // Process direct permissions
    if (file.permissions) {
      processPermissions(file.permissions, result, currentDomain, false);
    }
    
    // Attempt to detect inherited permissions by checking the immediate parent
    if (file.parents && file.parents.length > 0) {
      try {
        var parentId = file.parents[0];
        var parentFile = Drive.Files.get(parentId, { 
          fields: "permissions",
          supportsAllDrives: true 
        });
        if (parentFile.permissions) {
          processPermissions(parentFile.permissions, result, currentDomain, true);
        }
      } catch (err) {
        console.log("Could not fetch parent permissions", err);
      }
    }
    
    return result;
  } catch (e) {
    console.error("Error fetching Drive item details:", e);
    return null;
  }
}

function processPermissions(permissionsList, resultObj, currentDomain, isInherited) {
  permissionsList.forEach(function(perm) {
    var p = {
      role: perm.role,
      type: perm.type,
      email: perm.emailAddress,
      domain: perm.domain,
      displayName: perm.displayName,
      isInherited: isInherited,
      id: perm.id
    };
    
    if (perm.type === 'anyone') {
      resultObj.isPublic = true;
    }
    
    if ((perm.type === 'user' || perm.type === 'group') && perm.emailAddress) {
      var permDomain = perm.emailAddress.split('@')[1];
      if (permDomain && currentDomain && permDomain !== currentDomain) {
        resultObj.hasExternal = true;
        p.isExternal = true;
      }
    }
    
    // Avoid adding duplicates (e.g. if the API returns the inherited perm in both lists)
    var isDuplicate = resultObj.directPermissions.some(function(existing) {
      return existing.id === p.id;
    }) || resultObj.inheritedPermissions.some(function(existing) {
      return existing.id === p.id;
    });

    if (!isDuplicate) {
      if (isInherited) {
        resultObj.inheritedPermissions.push(p);
      } else {
        resultObj.directPermissions.push(p);
      }
    }
  });
}
