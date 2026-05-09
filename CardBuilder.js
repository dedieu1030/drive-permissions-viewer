var ICONS = {
  SHIELD: "https://www.gstatic.com/images/icons/material/system/1x/security_gm_grey_48dp.png",
  DRIVE: "https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
  PERSON: "https://www.gstatic.com/images/icons/material/system/1x/person_gm_grey_48dp.png",
  DELETE: "https://www.gstatic.com/images/icons/material/system/1x/close_gm_grey_48dp.png",
  FOLDER: "https://www.gstatic.com/images/icons/material/system/1x/folder_gm_grey_48dp.png"
};

// ============================================================
//  HOMEPAGE
// ============================================================

function createHomepageCard() {
  var card = CardService.newCardBuilder();
  var entries = getOffboardEntries();

  var s = CardService.newCardSection();

  s.addWidget(CardService.newTextParagraph().setText(
    "<font color='#0842a0'><b>Audit de sécurité Drive</b></font>"
  ));
  s.addWidget(CardService.newTextParagraph().setText(
    "<b>Auditer vos fichiers depuis Google Drive™️</b><br>" +
    "1. Sélectionnez un fichier ou dossier dans votre Drive<br>" +
    "2. Consultez les accès et le score de sécurité<br>" +
    "3. Révoquez les accès suspects en un clic"
  ));

  s.addWidget(CardService.newTextParagraph().setText("<br>"));

  // --- RECHERCHE DE DOCUMENT (en haut) ---
  s.addWidget(CardService.newTextParagraph().setText("<b>Recherche de document</b>"));
  s.addWidget(CardService.newTextParagraph().setText(
    "<font color='#5e5e5e'>Recherchez un fichier ou dossier pour voir qui y a accès</font>"
  ));

  s.addWidget(CardService.newTextInput()
    .setFieldName("docSearchQuery")
    .setTitle("Nom du document ou dossier"));

  s.addWidget(CardService.newTextButton()
    .setText("Rechercher")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor("#c2e7ff")
    .setOnClickAction(CardService.newAction().setFunctionName("handleDocSearch")));

  s.addWidget(CardService.newTextParagraph().setText("<br>"));

  // --- OFFBOARDING (en bas) ---
  s.addWidget(CardService.newTextParagraph().setText("<b>Offboarding</b>"));

  s.addWidget(CardService.newTextInput()
    .setFieldName("newEmail")
    .setTitle("Email du collaborateur"));

  s.addWidget(CardService.newTextButton()
    .setText("Ajouter")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor("#c2e7ff")
    .setOnClickAction(CardService.newAction().setFunctionName("handleAddEmail")));

  if (entries.length > 0) {
    s.addWidget(CardService.newTextParagraph().setText("<br>"));

    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5e5e5e'>" + entries.length + " collaborateur" + (entries.length > 1 ? "s" : "") + "</font>"
    ));

    var showCount = Math.min(entries.length, 8);
    for (var i = 0; i < showCount; i++) {
      var entry = entries[i];
      var iconUrl = entry.photo || ICONS.PERSON;
      s.addWidget(CardService.newDecoratedText()
        .setText(entry.email)
        .setStartIcon(CardService.newIconImage().setIconUrl(iconUrl).setImageCropType(CardService.ImageCropType.CIRCLE))
        .setButton(CardService.newImageButton()
          .setIconUrl(ICONS.DELETE)
          .setOnClickAction(CardService.newAction().setFunctionName("handleRemoveEmail").setParameters({email: entry.email}))));
    }
    if (entries.length > 8) {
      s.addWidget(CardService.newTextParagraph().setText(
        "<font color='#5e5e5e'>+" + (entries.length - 8) + " autres</font>"
      ));
    }

    s.addWidget(CardService.newTextParagraph().setText("<br>"));

    s.addWidget(CardService.newButtonSet()
      .addButton(CardService.newTextButton()
        .setText("Lancer l'analyse")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor("#c2e7ff")
        .setOnClickAction(CardService.newAction().setFunctionName("handleSearchUserAccess")))
      .addButton(CardService.newTextButton()
        .setText("Vider")
        .setOnClickAction(CardService.newAction().setFunctionName("handleClearEmails"))));
  }

  s.addWidget(CardService.newTextParagraph().setText("<br>"));

  s.addWidget(CardService.newTextParagraph().setText(
    "<font color='#5e5e5e'>Importez depuis un Google Sheets (emails en colonne A)</font>"
  ));

  s.addWidget(CardService.newTextInput()
    .setFieldName("sheetUrl")
    .setTitle("Lien du fichier Sheets"));

  s.addWidget(CardService.newTextButton()
    .setText("Importer")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor("#c2e7ff")
    .setOnClickAction(CardService.newAction().setFunctionName("handleImportSheet")));

  card.addSection(s);
  return card.build();
}

// ============================================================
//  MULTIPLE ITEMS
// ============================================================

function createMultipleItemsCard() {
  return CardService.newCardBuilder()
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText(
        "<font color='#5e5e5e'>Veuillez sélectionner un seul élément.</font>")))
    .build();
}

// ============================================================
//  FILE PERMISSION CARD
// ============================================================

function buildPermissionCard(fileId, filterValue) {
  var details = getDriveItemDetails(fileId);
  if (!details) return createHomepageCard();

  filterValue = filterValue || "ALL";
  var card = CardService.newCardBuilder();

  var headerIcon = details.iconUrl || ICONS.DRIVE;
  card.setHeader(CardService.newCardHeader()
    .setTitle(details.name)
    .setSubtitle(details.owner)
    .setImageUrl(headerIcon));

  var s = CardService.newCardSection();

  var scoreColor = details.score > 80 ? "#34a853" : (details.score > 40 ? "#fbbc04" : "#ea4335");
  var statusLabel = details.isPublic ? "Public" : (details.hasExternal ? "Externe" : "Privé");

  // Explication du niveau de risque
  var riskLabel = "";
  if (details.score > 80) riskLabel = "Risque faible";
  else if (details.score > 40) riskLabel = "Risque modéré";
  else riskLabel = "Risque élevé";

  s.addWidget(CardService.newDecoratedText()
    .setTopLabel("Score de sécurité")
    .setText("<font color='" + scoreColor + "'><b>" + details.score + "/100</b></font>  —  " + riskLabel)
    .setBottomLabel("Visibilité : " + statusLabel)
    .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.SHIELD)));

  var breadcrumbs = details.path.join("  ›  ") || "Mon Drive";
  s.addWidget(CardService.newDecoratedText()
    .setTopLabel("Emplacement dans le Drive")
    .setText(breadcrumbs)
    .setWrapText(true)
    .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.FOLDER)));

  s.addWidget(CardService.newTextParagraph().setText("<br>"));

  s.addWidget(CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName("roleFilter")
    .addItem("Tous les rôles", "ALL", filterValue === "ALL")
    .addItem("Propriétaire", "owner", filterValue === "owner")
    .addItem("Éditeur", "writer", filterValue === "writer")
    .addItem("Lecteur", "reader", filterValue === "reader")
    .setOnChangeAction(CardService.newAction().setFunctionName("handleFilterChange").setParameters({fileId: fileId})));

  var allPerms = details.directPermissions.concat(details.inheritedPermissions);
  if (filterValue !== "ALL") {
    allPerms = allPerms.filter(function(p) { return p.role === filterValue; });
  }

  if (allPerms.length === 0) {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5e5e5e'>Aucun résultat.</font>"
    ));
  } else {
    allPerms.forEach(function(p) {
      var emailText = p.email || p.domain || (p.type === 'anyone' ? 'Public' : p.displayName || p.type);
      var roleLabel = getRoleLabel(p.role);
      var suffix = p.isExternal ? " <font color='#fbbc04'>ext.</font>" : "";
      var bottomParts = [roleLabel];
      if (p.isInherited) bottomParts.push("hérité");

      var avatarUrl = p.photoLink ? (p.photoLink.startsWith('//') ? 'https:' + p.photoLink : p.photoLink) : "";

      var w = CardService.newDecoratedText()
        .setText(emailText + suffix)
        .setBottomLabel(bottomParts.join("  •  "));

      if (avatarUrl) {
        w.setStartIcon(CardService.newIconImage()
          .setIconUrl(avatarUrl)
          .setImageCropType(CardService.ImageCropType.CIRCLE));
      } else {
        w.setStartIcon(CardService.newIconImage()
          .setIconUrl(ICONS.PERSON)
          .setImageCropType(CardService.ImageCropType.CIRCLE));
      }

      w.setOnClickAction(CardService.newAction()
        .setFunctionName("handleMemberClick")
        .setParameters({
          fileId: fileId,
          permId: p.id,
          email: emailText,
          role: p.role,
          isInherited: p.isInherited ? "true" : "false",
          photoLink: avatarUrl || "",
          ownerEmail: details.owner,
          canShare: details.canShare ? "true" : "false"
        }));

      s.addWidget(w);
    });
  }

  card.addSection(s);
  return card.build();
}

// ============================================================
//  MEMBER DETAILS CARD
// ============================================================

function buildMemberDetailsCard(fileId, permId, email, role, isInherited, photoLink, canShare) {
  var card = CardService.newCardBuilder();
  var s = CardService.newCardSection();

  // Avatar, Email et Rôle groupés dans le corps
  var avatarUrl = photoLink || ICONS.PERSON;
  s.addWidget(CardService.newDecoratedText()
    .setText("<b>" + email + "</b>")
    .setBottomLabel(getRoleLabel(role))
    .setStartIcon(CardService.newIconImage()
      .setIconUrl(avatarUrl)
      .setImageCropType(CardService.ImageCropType.CIRCLE)));

  if (role === 'owner') {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5e5e5e'>Le propriétaire ne peut pas être supprimé ici.</font>"
    ));
  } else if (isInherited) {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5e5e5e'>Accès hérité d'un dossier parent.</font>"
    ));
  } else if (!canShare) {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#ea4335'>Les restrictions de partage de ce fichier vous empêchent de supprimer des accès.</font>"
    ));
  } else {
    s.addWidget(CardService.newTextParagraph().setText("<br>"));

    s.addWidget(CardService.newTextButton()
      .setText("Révoquer l'accès")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor("#ea4335")
      .setOnClickAction(CardService.newAction().setFunctionName("handleRevokeAccess").setParameters({fileId: fileId, permId: permId})));
  }

  card.addSection(s);
  return card.build();
}

// ============================================================
//  HANDLERS
// ============================================================

function handleFilterChange(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildPermissionCard(e.parameters.fileId, e.formInput.roleFilter)))
    .build();
}

function getRoleLabel(role) {
  return {'owner': 'Propriétaire', 'writer': 'Éditeur', 'commenter': 'Commentateur', 'reader': 'Lecteur'}[role] || role;
}

function handleMemberClick(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildMemberDetailsCard(
      e.parameters.fileId, e.parameters.permId, e.parameters.email,
      e.parameters.role, e.parameters.isInherited === "true", e.parameters.photoLink,
      e.parameters.canShare === "true")))
    .build();
}

function handleChangeRole(e) {
  // Cette fonction n'est plus utilisée dans l'interface simplifiée, mais conservée pour compatibilité ou usage futur
  var success = updatePermissionRole(e.parameters.fileId, e.parameters.permId, e.formInput.newRole);
  var resp = CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(success ? "Rôle mis à jour." : "Erreur."));
  if (success) resp.setNavigation(CardService.newNavigation().popCard().updateCard(buildPermissionCard(e.parameters.fileId)));
  return resp.build();
}

function handleRevokeAccess(e) {
  var result = revokePermission(e.parameters.fileId, e.parameters.permId);
  var msg = result.success ? "Accès révoqué." : "Erreur : " + result.error;
  var resp = CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(msg));
  if (result.success) resp.setNavigation(CardService.newNavigation().popCard().updateCard(buildPermissionCard(e.parameters.fileId)));
  return resp.build();
}

// ============================================================
//  OFFBOARDING HANDLERS
// ============================================================

function handleAddEmail(e) {
  if (e.formInput.newEmail) addOffboardEmail(e.formInput.newEmail);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard())).build();
}

function handleRemoveEmail(e) {
  removeOffboardEmail(e.parameters.email);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard())).build();
}

function handleClearEmails(e) {
  clearOffboardEmails();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard())).build();
}

function handleImportSheet(e) {
  var url = e.formInput.sheetUrl;
  if (!url) return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Collez un lien.")).build();
  try {
    var data = SpreadsheetApp.openByUrl(url).getActiveSheet().getRange("A1:A1000").getValues();
    var found = [];
    for (var i = 0; i < data.length; i++) {
      var v = String(data[i][0]).trim();
      if (v && v.indexOf('@') !== -1) found.push(v);
    }
    if (found.length > 0) {
      addOffboardEmails(found);
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(found.length + " emails importés."))
        .setNavigation(CardService.newNavigation().updateCard(createHomepageCard())).build();
    }
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Aucun email en colonne A.")).build();
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Lien invalide ou accès refusé.")).build();
  }
}

function handleSearchUserAccess(e) {
  var entries = getOffboardEntries();
  if (entries.length === 0) return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Ajoutez au moins un email.")).build();

  var emails = entries.map(function(e) { return e.email; });
  var files = searchUserAccess(emails.join(','));
  
  // Stocker les fichiers trouvés
  storeFoundFiles(files);
  
  var card = buildResultsCard(entries, files);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card)).build();
}

function buildResultsCard(entries, files, showCount) {
  showCount = showCount || 12;
  
  var card = CardService.newCardBuilder();

  var s = CardService.newCardSection();

  s.addWidget(CardService.newTextParagraph().setText(
    "<b>Résultats de l'analyse</b>"
  ));

  // Affichage simple du nombre de collaborateurs (demande de simplification)
  s.addWidget(CardService.newTextParagraph().setText(
    "<font color='#5e5e5e'>" + entries.length + " collaborateur" + (entries.length > 1 ? "s" : "") + " ciblé" + (entries.length > 1 ? "s" : "") + "</font>"
  ));

  s.addWidget(CardService.newTextParagraph().setText("<br>"));

  if (files.length === 0) {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5e5e5e'>Aucun accès trouvé.</font>"
    ));
  } else {
    var exposedColumns = CardService.newColumns();
    exposedColumns.addColumn(CardService.newColumn()
      .setVerticalAlignment(CardService.VerticalAlignment.CENTER)
      .addWidget(CardService.newTextParagraph().setText("<b>" + files.length + " éléments exposés</b>")));
    
    exposedColumns.addColumn(CardService.newColumn()
      .setHorizontalAlignment(CardService.HorizontalAlignment.END)
      .setVerticalAlignment(CardService.VerticalAlignment.CENTER)
      .addWidget(CardService.newButtonList()
        .addButton(CardService.newTextButton()
          .setText("Sélectionner")
          .setOnClickAction(CardService.newAction().setFunctionName("handleSelectMode")))));
    
    s.addWidget(exposedColumns);

    var displayCount = Math.min(files.length, showCount);
    for (var j = 0; j < displayCount; j++) {
      var file = files[j];
      var fileIcon = file.icon || ICONS.FOLDER;
      s.addWidget(CardService.newDecoratedText()
        .setText(file.name)
        .setStartIcon(CardService.newIconImage().setIconUrl(fileIcon))
        .setButton(CardService.newImageButton()
          .setIconUrl(ICONS.DELETE)
          .setOnClickAction(CardService.newAction().setFunctionName("handleRemoveFile").setParameters({fileId: file.id, show: String(showCount)}))));
    }

    // Bouton "Voir plus" si il reste des fichiers
    if (files.length > showCount) {
      var remaining = files.length - showCount;
      s.addWidget(CardService.newTextButton()
        .setText("Voir plus (" + remaining + " restants)")
        .setOnClickAction(CardService.newAction().setFunctionName("handleShowMore").setParameters({show: String(showCount + 12)})));
    }

    s.addWidget(CardService.newTextParagraph().setText("<br>"));

    var emailInput = entries.map(function(e) { return e.email; }).join(',');
    s.addWidget(CardService.newTextButton()
      .setText("Révoquer tous les accès (" + files.length + ")")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor("#ea4335")
      .setOnClickAction(CardService.newAction().setFunctionName("handleMassRevoke").setParameters({email: emailInput})));
  }

  card.addSection(s);
  return card.build();
}

function noOp(e) {
  return CardService.newActionResponseBuilder().build();
}

function handleShowMore(e) {
  var newShow = parseInt(e.parameters.show, 10) || 24;
  var files = getFoundFiles();
  var entries = getOffboardEntries();
  var card = buildResultsCard(entries, files, newShow);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card)).build();
}

function handleRemoveFile(e) {
  var fileId = e.parameters.fileId;
  var showCount = parseInt(e.parameters.show, 10) || 12;
  var remainingFiles = removeFoundFile(fileId);
  var entries = getOffboardEntries();
  var card = buildResultsCard(entries, remainingFiles, showCount);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card)).build();
}

function handleMassRevoke(e) {
  var result = massRevokeUser(e.parameters.email);
  clearOffboardEmails();
  clearFoundFiles();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(result.revokedCount + " accès révoqués."))
    .setNavigation(CardService.newNavigation().popCard().updateCard(createHomepageCard())).build();
}


function handleSelectMode(e) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Mode sélection activé (bientôt disponible)"))
    .build();
}

// ============================================================
//  DOCUMENT SEARCH
// ============================================================

function handleDocSearch(e) {
  var query = e.formInput.docSearchQuery;
  if (!query || query.trim().length === 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Entrez un nom de document.")).build();
  }
  var results = searchFilesByName(query);
  var card = buildFileSearchResultsCard(query, results);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card)).build();
}

function buildFileSearchResultsCard(query, results) {
  var card = CardService.newCardBuilder();
  var s = CardService.newCardSection();

  s.addWidget(CardService.newTextParagraph().setText(
    "<b>Résultats pour \"" + query + "\"</b>"
  ));

  if (results.length === 0) {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5e5e5e'>Aucun document trouvé.</font>"
    ));
  } else {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5e5e5e'>" + results.length + " résultat" + (results.length > 1 ? "s" : "") + "</font>"
    ));

    results.forEach(function(file) {
      var fileIcon = file.icon || ICONS.FOLDER;
      var subtitle = file.isFolder ? "Dossier" : file.owner;
      var w = CardService.newDecoratedText()
        .setText(file.name)
        .setBottomLabel(subtitle)
        .setStartIcon(CardService.newIconImage().setIconUrl(fileIcon));

      if (file.isFolder) {
        w.setOnClickAction(CardService.newAction()
          .setFunctionName("handleOpenFolder")
          .setParameters({folderId: file.id, folderName: file.name}));
      } else {
        w.setOnClickAction(CardService.newAction()
          .setFunctionName("handleOpenFilePerms")
          .setParameters({fileId: file.id}));
      }

      s.addWidget(w);
    });
  }

  card.addSection(s);
  return card.build();
}

function handleOpenFilePerms(e) {
  var card = buildPermissionCard(e.parameters.fileId);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card)).build();
}

function handleOpenFolder(e) {
  var folderId = e.parameters.folderId;
  var folderName = e.parameters.folderName;
  var contents = listFolderContentsWithPermissions(folderId);
  var card = buildFolderContentsCard(folderName, folderId, contents);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card)).build();
}

function buildFolderContentsCard(folderName, folderId, contents) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(folderName)
      .setSubtitle(contents.length + " éléments")
      .setImageUrl(ICONS.FOLDER));

  if (contents.length === 0) {
    var emptySection = CardService.newCardSection();
    emptySection.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5e5e5e'>Ce dossier est vide.</font>"
    ));
    card.addSection(emptySection);
  } else {
    contents.forEach(function(file) {
      var fileSection = CardService.newCardSection();
      var fileIcon = file.icon || ICONS.FOLDER;

      // Titre du fichier cliquable
      var titleWidget = CardService.newDecoratedText()
        .setText("<b>" + file.name + "</b>")
        .setStartIcon(CardService.newIconImage().setIconUrl(fileIcon));

      if (file.isFolder) {
        titleWidget.setOnClickAction(CardService.newAction()
          .setFunctionName("handleOpenFolder")
          .setParameters({folderId: file.id, folderName: file.name}));
      } else {
        titleWidget.setOnClickAction(CardService.newAction()
          .setFunctionName("handleOpenFilePerms")
          .setParameters({fileId: file.id}));
      }
      fileSection.addWidget(titleWidget);

      // Permissions de ce fichier
      if (file.permissions && file.permissions.length > 0) {
        file.permissions.forEach(function(p) {
          var roleLabel = getRoleLabel(p.role);
          var avatarUrl = p.photoLink ? (p.photoLink.startsWith('//') ? 'https:' + p.photoLink : p.photoLink) : ICONS.PERSON;
          fileSection.addWidget(CardService.newDecoratedText()
            .setText(p.email)
            .setBottomLabel(roleLabel)
            .setStartIcon(CardService.newIconImage().setIconUrl(avatarUrl).setImageCropType(CardService.ImageCropType.CIRCLE)));
        });
      } else {
        fileSection.addWidget(CardService.newTextParagraph().setText(
          "<font color='#5e5e5e'>Aucun accès partagé</font>"
        ));
      }

      card.addSection(fileSection);
    });
  }

  return card.build();
}
