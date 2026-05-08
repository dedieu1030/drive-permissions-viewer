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
    "<b>Audit de sécurité Drive</b>"
  ));
  s.addWidget(CardService.newTextParagraph().setText(
    "Sélectionnez un document pour analyser ses permissions, ou lancez un offboarding ci-dessous."
  ));

  s.addWidget(CardService.newTextParagraph().setText("<br>"));

  s.addWidget(CardService.newTextParagraph().setText("<b>Offboarding</b>"));

  s.addWidget(CardService.newTextInput()
    .setFieldName("newEmail")
    .setTitle("Email du collaborateur"));

  s.addWidget(CardService.newTextButton()
    .setText("Ajouter")
    .setOnClickAction(CardService.newAction().setFunctionName("handleAddEmail")));

  if (entries.length > 0) {
    s.addWidget(CardService.newTextParagraph().setText("<br>"));

    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#9aa0a6'>" + entries.length + " collaborateur" + (entries.length > 1 ? "s" : "") + "</font>"
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
        "<font color='#9aa0a6'>+" + (entries.length - 8) + " autres</font>"
      ));
    }

    s.addWidget(CardService.newTextParagraph().setText("<br>"));

    s.addWidget(CardService.newButtonSet()
      .addButton(CardService.newTextButton()
        .setText("Lancer l'analyse")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor("#1a73e8")
        .setOnClickAction(CardService.newAction().setFunctionName("handleSearchUserAccess")))
      .addButton(CardService.newTextButton()
        .setText("Vider")
        .setOnClickAction(CardService.newAction().setFunctionName("handleClearEmails"))));
  }

  s.addWidget(CardService.newTextParagraph().setText("<br>"));

  s.addWidget(CardService.newTextParagraph().setText(
    "<font color='#9aa0a6'>Importez depuis un Google Sheets (emails en colonne A)</font>"
  ));

  s.addWidget(CardService.newTextInput()
    .setFieldName("sheetUrl")
    .setTitle("Lien du fichier Sheets"));

  s.addWidget(CardService.newTextButton()
    .setText("Importer")
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
        "<font color='#9aa0a6'>Veuillez sélectionner un seul élément.</font>")))
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

  var scoreColor = details.score > 80 ? "#188038" : (details.score > 40 ? "#e37400" : "#d93025");
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
      "<font color='#9aa0a6'>Aucun résultat.</font>"
    ));
  } else {
    allPerms.forEach(function(p) {
      var emailText = p.email || p.domain || (p.type === 'anyone' ? 'Public' : p.displayName || p.type);
      var roleLabel = getRoleLabel(p.role);
      var suffix = p.isExternal ? " <font color='#e37400'>ext.</font>" : "";
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
          photoLink: avatarUrl || ""
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

function buildMemberDetailsCard(fileId, permId, email, role, isInherited, photoLink) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(email)
      .setSubtitle(getRoleLabel(role)));

  var s = CardService.newCardSection();

  if (role === 'owner') {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#9aa0a6'>Le propriétaire ne peut pas être modifié ici.</font>"
    ));
  } else if (isInherited) {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#9aa0a6'>Accès hérité d'un dossier parent.</font>"
    ));
  } else {
    s.addWidget(CardService.newTextParagraph().setText("<b>Modifier le rôle</b>"));

    s.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setTitle("Rôle")
      .setFieldName("newRole")
      .addItem("Éditeur", "writer", role === "writer")
      .addItem("Commentateur", "commenter", role === "commenter")
      .addItem("Lecteur", "reader", role === "reader")
      .setOnChangeAction(CardService.newAction().setFunctionName("handleChangeRole").setParameters({fileId: fileId, permId: permId})));

    s.addWidget(CardService.newTextParagraph().setText("<br>"));

    s.addWidget(CardService.newTextButton()
      .setText("Révoquer l'accès")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor("#d93025")
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
      e.parameters.role, e.parameters.isInherited === "true", e.parameters.photoLink)))
    .build();
}

function handleChangeRole(e) {
  var success = updatePermissionRole(e.parameters.fileId, e.parameters.permId, e.formInput.newRole);
  var resp = CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(success ? "Rôle mis à jour." : "Erreur."));
  if (success) resp.setNavigation(CardService.newNavigation().popCard().updateCard(buildPermissionCard(e.parameters.fileId)));
  return resp.build();
}

function handleRevokeAccess(e) {
  var success = revokePermission(e.parameters.fileId, e.parameters.permId);
  var resp = CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(success ? "Accès révoqué." : "Erreur."));
  if (success) resp.setNavigation(CardService.newNavigation().popCard().updateCard(buildPermissionCard(e.parameters.fileId)));
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

function buildResultsCard(entries, files) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Résultats de l'analyse"));

  // Section 1 : Aperçu des collaborateurs ciblés
  var emailSection = CardService.newCardSection();

  var previewCount = Math.min(entries.length, 3);
  for (var i = 0; i < previewCount; i++) {
    var entry = entries[i];
    var iconUrl = entry.photo || ICONS.PERSON;
    emailSection.addWidget(CardService.newDecoratedText()
      .setText(entry.email)
      .setStartIcon(CardService.newIconImage().setIconUrl(iconUrl).setImageCropType(CardService.ImageCropType.CIRCLE)));
  }
  if (entries.length > 3) {
    emailSection.addWidget(CardService.newTextParagraph().setText(
      "<font color='#9aa0a6'>+" + (entries.length - 3) + " autre" + ((entries.length - 3) > 1 ? "s" : "") + "</font>"
    ));
  }
  card.addSection(emailSection);

  // Section 2 : Fichiers exposés
  var fileSection = CardService.newCardSection();

  if (files.length === 0) {
    fileSection.addWidget(CardService.newTextParagraph().setText(
      "<font color='#9aa0a6'>Aucun accès trouvé.</font>"
    ));
  } else {
    fileSection.addWidget(CardService.newTextParagraph().setText(
      "<b>" + files.length + " élément" + (files.length > 1 ? "s" : "") + " exposé" + (files.length > 1 ? "s" : "") + "</b>"
    ));

    // Afficher TOUS les fichiers avec icône + bouton supprimer
    for (var j = 0; j < files.length; j++) {
      var file = files[j];
      var fileIcon = file.icon || ICONS.FOLDER;
      fileSection.addWidget(CardService.newDecoratedText()
        .setText(file.name)
        .setStartIcon(CardService.newIconImage().setIconUrl(fileIcon))
        .setButton(CardService.newImageButton()
          .setIconUrl(ICONS.DELETE)
          .setOnClickAction(CardService.newAction().setFunctionName("handleRemoveFile").setParameters({fileId: file.id}))));
    }

    fileSection.addWidget(CardService.newTextParagraph().setText("<br>"));

    var emailInput = entries.map(function(e) { return e.email; }).join(',');
    fileSection.addWidget(CardService.newTextButton()
      .setText("Révoquer tous les accès (" + files.length + ")")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor("#d93025")
      .setOnClickAction(CardService.newAction().setFunctionName("handleMassRevoke").setParameters({email: emailInput})));
  }

  card.addSection(fileSection);
  return card.build();
}

function handleRemoveFile(e) {
  var fileId = e.parameters.fileId;
  var remainingFiles = removeFoundFile(fileId);
  var entries = getOffboardEntries();
  var card = buildResultsCard(entries, remainingFiles);
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

