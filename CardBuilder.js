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
  var emails = getOffboardEmails();

  // --- Unique section : tout est ici, pas de barres inutiles ---
  var s = CardService.newCardSection();

  // Titre + description aérée
  s.addWidget(CardService.newTextParagraph().setText(
    "<b><font color='#202124'>Audit de sécurité Drive</font></b>"
  ));
  s.addWidget(CardService.newTextParagraph().setText(
    "<font color='#5f6368'>Sélectionnez un document pour analyser ses permissions, ou lancez un offboarding ci-dessous.</font>"
  ));

  // Spacer
  s.addWidget(CardService.newDivider());

  // Offboarding : titre discret
  s.addWidget(CardService.newTextParagraph().setText(
    "<b><font color='#202124'>Offboarding</font></b>"
  ));

  // Input email
  s.addWidget(CardService.newTextInput()
    .setFieldName("newEmail")
    .setTitle("Email du collaborateur")
    .setHint("ex : jean.dupont@entreprise.com"));

  s.addWidget(CardService.newTextButton()
    .setText("Ajouter")
    .setOnClickAction(CardService.newAction().setFunctionName("handleAddEmail")));

  // Liste des emails ajoutés
  if (emails.length > 0) {
    // Spacer
    s.addWidget(CardService.newTextParagraph().setText(" "));

    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#5f6368'>" + emails.length + " collaborateur" + (emails.length > 1 ? "s" : "") + " ciblé" + (emails.length > 1 ? "s" : "") + "</font>"
    ));

    var showCount = Math.min(emails.length, 8);
    for (var i = 0; i < showCount; i++) {
      s.addWidget(CardService.newDecoratedText()
        .setText(emails[i])
        .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.PERSON).setImageCropType(CardService.ImageCropType.CIRCLE))
        .setButton(CardService.newImageButton()
          .setIconUrl(ICONS.DELETE)
          .setOnClickAction(CardService.newAction().setFunctionName("handleRemoveEmail").setParameters({email: emails[i]}))));
    }
    if (emails.length > 8) {
      s.addWidget(CardService.newTextParagraph().setText(
        "<font color='#80868b'>+" + (emails.length - 8) + " autres</font>"
      ));
    }

    // Spacer
    s.addWidget(CardService.newTextParagraph().setText(" "));

    s.addWidget(CardService.newButtonSet()
      .addButton(CardService.newTextButton()
        .setText("Lancer l'analyse")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor("#1a73e8")
        .setOnClickAction(CardService.newAction().setFunctionName("handleSearchUserAccess")))
      .addButton(CardService.newTextButton()
        .setText("Vider la liste")
        .setOnClickAction(CardService.newAction().setFunctionName("handleClearEmails"))));
  }

  // Spacer
  s.addWidget(CardService.newDivider());

  // Import Google Sheets — discret, secondaire
  s.addWidget(CardService.newTextParagraph().setText(
    "<font color='#80868b'>Ou importez depuis un Google Sheets (emails en colonne A)</font>"
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
        "<font color='#5f6368'>Veuillez sélectionner un seul élément.</font>")))
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

  // Header : Nom du fichier
  card.setHeader(CardService.newCardHeader()
    .setTitle(details.name)
    .setSubtitle(details.owner));

  // --- Section unique : Score + chemin ---
  var s1 = CardService.newCardSection();

  var scoreColor = details.score > 80 ? "#188038" : (details.score > 40 ? "#e37400" : "#d93025");
  var statusLabel = details.isPublic ? "Public" : (details.hasExternal ? "Externe" : "Privé");

  s1.addWidget(CardService.newTextParagraph().setText(
    "<font color='" + scoreColor + "'><b>" + details.score + "/100</b></font>" +
    "  <font color='#5f6368'>•  " + statusLabel + "</font>"
  ));

  var breadcrumbs = details.path.join("  ›  ") || "Mon Drive";
  s1.addWidget(CardService.newTextParagraph().setText(
    "<font color='#80868b'>" + breadcrumbs + "</font>"
  ));

  card.addSection(s1);

  // --- Section : Filtre + Membres ---
  var s2 = CardService.newCardSection();

  s2.addWidget(CardService.newSelectionInput()
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
    s2.addWidget(CardService.newTextParagraph().setText(
      "<font color='#80868b'>Aucun résultat pour ce filtre.</font>"
    ));
  } else {
    allPerms.forEach(function(p) {
      var emailText = p.email || p.domain || (p.type === 'anyone' ? 'Public' : p.displayName || p.type);
      var roleLabel = getRoleLabel(p.role);
      var suffix = p.isExternal ? " <font color='#e37400'>ext.</font>" : "";
      var origin = p.isInherited ? "hérité" : "";
      var bottomParts = [roleLabel];
      if (origin) bottomParts.push(origin);

      var avatarUrl = p.photoLink ? (p.photoLink.startsWith('//') ? 'https:' + p.photoLink : p.photoLink) : "";

      var w = CardService.newDecoratedText()
        .setText("<b>" + emailText + "</b>" + suffix)
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

      s2.addWidget(w);
    });
  }

  card.addSection(s2);
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

  if (photoLink) {
    var memberWidget = CardService.newDecoratedText()
      .setText("<b>" + email + "</b>")
      .setBottomLabel(getRoleLabel(role))
      .setStartIcon(CardService.newIconImage()
        .setIconUrl(photoLink)
        .setImageCropType(CardService.ImageCropType.CIRCLE));
    s.addWidget(memberWidget);
  }

  // Spacer
  s.addWidget(CardService.newTextParagraph().setText(" "));

  if (role === 'owner') {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#80868b'>Le propriétaire ne peut pas être modifié ici.</font>"
    ));
  } else if (isInherited) {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#80868b'>Accès hérité d'un dossier parent. Modifiez le dossier parent pour ajuster.</font>"
    ));
  } else {
    s.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setTitle("Modifier le rôle")
      .setFieldName("newRole")
      .addItem("Éditeur", "writer", role === "writer")
      .addItem("Commentateur", "commenter", role === "commenter")
      .addItem("Lecteur", "reader", role === "reader")
      .setOnChangeAction(CardService.newAction().setFunctionName("handleChangeRole").setParameters({fileId: fileId, permId: permId})));

    // Spacer
    s.addWidget(CardService.newTextParagraph().setText(" "));

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
//  HANDLERS — NAVIGATION
// ============================================================

function handleFilterChange(e) {
  var fileId = e.parameters.fileId;
  var selectedFilter = e.formInput.roleFilter;
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildPermissionCard(fileId, selectedFilter)))
    .build();
}

function getRoleLabel(role) {
  var m = {'owner': 'Propriétaire', 'writer': 'Éditeur', 'commenter': 'Commentateur', 'reader': 'Lecteur'};
  return m[role] || role;
}

function handleExportClick(e) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Audit exporté."))
    .build();
}

function handleMemberClick(e) {
  var card = buildMemberDetailsCard(
    e.parameters.fileId,
    e.parameters.permId,
    e.parameters.email,
    e.parameters.role,
    e.parameters.isInherited === "true",
    e.parameters.photoLink
  );
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function handleChangeRole(e) {
  var fileId = e.parameters.fileId;
  var permId = e.parameters.permId;
  var newRole = e.formInput.newRole;
  var success = updatePermissionRole(fileId, permId, newRole);
  var msg = success ? "Rôle mis à jour." : "Erreur lors de la mise à jour.";
  var resp = CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(msg));
  if (success) {
    resp.setNavigation(CardService.newNavigation().popCard().updateCard(buildPermissionCard(fileId)));
  }
  return resp.build();
}

function handleRevokeAccess(e) {
  var fileId = e.parameters.fileId;
  var permId = e.parameters.permId;
  var success = revokePermission(fileId, permId);
  var msg = success ? "Accès révoqué." : "Erreur lors de la révocation.";
  var resp = CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(msg));
  if (success) {
    resp.setNavigation(CardService.newNavigation().popCard().updateCard(buildPermissionCard(fileId)));
  }
  return resp.build();
}

// ============================================================
//  HANDLERS — OFFBOARDING
// ============================================================

function handleAddEmail(e) {
  var email = e.formInput.newEmail;
  if (email) addOffboardEmail(email);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard()))
    .build();
}

function handleRemoveEmail(e) {
  removeOffboardEmail(e.parameters.email);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard()))
    .build();
}

function handleClearEmails(e) {
  clearOffboardEmails();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard()))
    .build();
}

function handleImportSheet(e) {
  var url = e.formInput.sheetUrl;
  if (!url) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Collez un lien Google Sheets."))
      .build();
  }
  try {
    var ss = SpreadsheetApp.openByUrl(url);
    var data = ss.getActiveSheet().getRange("A1:A1000").getValues();
    var newEmails = [];
    for (var i = 0; i < data.length; i++) {
      var val = String(data[i][0]).trim();
      if (val && val.indexOf('@') !== -1) newEmails.push(val);
    }
    if (newEmails.length > 0) {
      addOffboardEmails(newEmails);
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(newEmails.length + " emails importés."))
        .setNavigation(CardService.newNavigation().updateCard(createHomepageCard()))
        .build();
    }
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Aucun email trouvé en colonne A."))
      .build();
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Lien invalide ou accès refusé."))
      .build();
  }
}

function handleSearchUserAccess(e) {
  var emails = getOffboardEmails();
  if (emails.length === 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Ajoutez au moins un email."))
      .build();
  }

  var emailInput = emails.join(',');
  var files = searchUserAccess(emailInput);

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle("Résultats")
      .setSubtitle(emails.length + " collaborateur" + (emails.length > 1 ? "s" : "")));

  var s = CardService.newCardSection();

  if (files.length === 0) {
    s.addWidget(CardService.newTextParagraph().setText(
      "<font color='#80868b'>Aucun accès direct trouvé.</font>"
    ));
  } else {
    s.addWidget(CardService.newTextParagraph().setText(
      "<b><font color='#202124'>" + files.length + " élément" + (files.length > 1 ? "s" : "") + " exposé" + (files.length > 1 ? "s" : "") + "</font></b>"
    ));

    // Spacer
    s.addWidget(CardService.newTextParagraph().setText(" "));

    var displayCount = Math.min(files.length, 12);
    for (var i = 0; i < displayCount; i++) {
      s.addWidget(CardService.newDecoratedText()
        .setText(files[i].name)
        .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.FOLDER)));
    }
    if (files.length > 12) {
      s.addWidget(CardService.newTextParagraph().setText(
        "<font color='#80868b'>+" + (files.length - 12) + " autres</font>"
      ));
    }

    // Spacer
    s.addWidget(CardService.newTextParagraph().setText(" "));

    s.addWidget(CardService.newTextButton()
      .setText("Révoquer tous les accès")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor("#d93025")
      .setOnClickAction(CardService.newAction().setFunctionName("handleMassRevoke").setParameters({email: emailInput})));
  }

  card.addSection(s);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

function handleMassRevoke(e) {
  var result = massRevokeUser(e.parameters.email);
  clearOffboardEmails();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(result.revokedCount + " accès révoqués."))
    .setNavigation(CardService.newNavigation().popCard().updateCard(createHomepageCard()))
    .build();
}
