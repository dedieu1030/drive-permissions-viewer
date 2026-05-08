var ICONS = {
  SHIELD: "https://www.gstatic.com/images/icons/material/system/1x/security_black_48dp.png",
  DRIVE: "https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
  OWNER: "https://www.gstatic.com/images/icons/material/system/1x/person_black_48dp.png",
  PUBLIC: "https://www.gstatic.com/images/icons/material/system/1x/public_black_48dp.png",
  EXTERNAL: "https://www.gstatic.com/images/icons/material/system/1x/domain_black_48dp.png",
  GROUP: "https://www.gstatic.com/images/icons/material/system/1x/group_black_48dp.png",
  EDIT: "https://www.gstatic.com/images/icons/material/system/1x/edit_black_48dp.png",
  VIEW: "https://www.gstatic.com/images/icons/material/system/1x/visibility_black_48dp.png",
  PATH: "https://www.gstatic.com/images/icons/material/system/1x/folder_open_black_48dp.png"
};

function createHomepageCard() {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader()
    .setTitle("Permissions Audit")
    .setImageUrl(ICONS.SHIELD)
    .setImageStyle(CardService.ImageStyle.CIRCLE));
  
  card.addSection(CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("<b>Audit de sécurité</b><br>Sélectionnez un document pour analyser ses risques.")));
  
  return card.build();
}

function createMultipleItemsCard() {
  return CardService.newCardBuilder()
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText("⚠️ Veuillez sélectionner un seul élément.")))
    .build();
}

function buildPermissionCard(fileId, filterValue) {
  var details = getDriveItemDetails(fileId);
  if (!details) return createHomepageCard();
  
  filterValue = filterValue || "ALL";
  var card = CardService.newCardBuilder();
  
  // Header ultra compact
  card.setHeader(CardService.newCardHeader()
    .setTitle(details.name)
    .setImageUrl(ICONS.DRIVE)
    .setImageStyle(CardService.ImageStyle.CIRCLE));

  // --- SECTION 1 : AUDIT RÉSUMÉ (Compact) ---
  var summarySection = CardService.newCardSection();
  
  // Score & Statut combinés
  var scoreColor = details.score > 80 ? "#188038" : (details.score > 40 ? "#e37400" : "#d93025");
  var statusText = details.isPublic ? "PUBLIC" : (details.hasExternal ? "EXTERNE" : "PRIVÉ");
  
  summarySection.addWidget(CardService.newDecoratedText()
    .setText("<font color='" + scoreColor + "'><b>Score : " + details.score + "/100 • " + statusText + "</b></font>")
    .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.SHIELD)));

  // Hiérarchie simplifiée
  var breadcrumbs = details.path.join(" > ") || "Mon Drive";
  summarySection.addWidget(CardService.newDecoratedText()
    .setTopLabel("Emplacement")
    .setText("<font color='#5f6368'>" + breadcrumbs + "</font>")
    .setWrapText(true));
    
  // Propriétaire (intégré ici pour gagner de la place)
  summarySection.addWidget(CardService.newDecoratedText()
    .setTopLabel("Propriétaire")
    .setText("<b>" + details.owner + "</b>"));

  card.addSection(summarySection);

  // --- SECTION 2 : FILTRES ---
  var filterSection = CardService.newCardSection();
  filterSection.addWidget(CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName("roleFilter")
    .addItem("Tous les membres", "ALL", filterValue === "ALL")
    .addItem("Propriétaires", "owner", filterValue === "owner")
    .addItem("Éditeurs", "writer", filterValue === "writer")
    .addItem("Lecteurs", "reader", filterValue === "reader")
    .setOnChangeAction(CardService.newAction().setFunctionName("handleFilterChange").setParameters({fileId: fileId})));
    
  card.addSection(filterSection);

  // --- SECTION 3 : LISTE DES MEMBRES (Défilable naturellement) ---
  var accessSection = CardService.newCardSection().setHeader("Membres ayant accès");
  var allPerms = details.directPermissions.concat(details.inheritedPermissions);
  
  if (filterValue !== "ALL") {
    allPerms = allPerms.filter(function(p) { return p.role === filterValue; });
  }
  
  if (allPerms.length === 0) {
    accessSection.addWidget(CardService.newTextParagraph().setText("<i>Aucun membre trouvé.</i>"));
  } else {
    allPerms.forEach(function(p) {
      // On garde uniquement l'icône de droite pour le rôle
      var roleIcon = (p.role === 'reader' || p.role === 'commenter') ? ICONS.VIEW : ICONS.EDIT;
      if (p.role === 'owner') roleIcon = ICONS.OWNER;
      
      var origin = p.isInherited ? "Hérité" : "Direct";
      var nameText = "<b>" + (p.email || p.domain || (p.type === 'anyone' ? 'Public' : p.displayName || p.type)) + "</b>";
      if (p.isExternal) nameText += " <font color='#e37400'>(Ext.)</font>";

      var decoratedText = CardService.newDecoratedText()
        .setTopLabel(origin + " • " + getRoleLabel(p.role))
        .setText(nameText)
        .setEndIcon(CardService.newIconImage().setIconUrl(roleIcon));
        
      // Si on a un avatar (photoLink), on l'utilise à gauche.
      if (p.photoLink) {
        // L'URL de photoLink peut commencer par // au lieu de https://
        var avatarUrl = p.photoLink.startsWith('//') ? 'https:' + p.photoLink : p.photoLink;
        decoratedText.setStartIcon(CardService.newIconImage().setIconUrl(avatarUrl));
      }

      accessSection.addWidget(decoratedText);
    });
  }
  card.addSection(accessSection);

  // --- SECTION 4 : FOOTER ---
  card.addSection(CardService.newCardSection()
    .addWidget(CardService.newTextButton()
      .setText("EXPORTER L'AUDIT")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName("handleExportClick").setParameters({fileId: details.id, fileName: details.name}))));
  
  return card.build();
}

function handleFilterChange(e) {
  var fileId = e.parameters.fileId;
  var selectedFilter = e.formInput.roleFilter;
  var updatedCard = buildPermissionCard(fileId, selectedFilter);
  return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().updateCard(updatedCard)).build();
}

function getRoleLabel(role) {
  var roles = {'owner': 'Propriétaire', 'writer': 'Éditeur', 'commenter': 'Commentateur', 'reader': 'Lecteur'};
  return roles[role] || role;
}

function handleExportClick(e) {
  return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Audit exporté.")).build();
}
